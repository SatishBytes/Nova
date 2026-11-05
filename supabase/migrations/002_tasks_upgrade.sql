-- Phase 2 task metadata, ordering, subtasks, and owner-only RLS.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS position double precision,
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass
      AND conname = 'tasks_priority_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END
$$;

-- Assign stable gaps between existing tasks to make fractional reordering practical.
WITH ranked_tasks AS (
  SELECT id,
         (row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) - 1) * 1000.0 AS next_position
  FROM public.tasks
)
UPDATE public.tasks AS task
SET position = ranked_tasks.next_position
FROM ranked_tasks
WHERE task.id = ranked_tasks.id
  AND task.position IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN position SET DEFAULT 0,
  ALTER COLUMN position SET NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_project_status_position_idx
  ON public.tasks (project_id, status, position);

CREATE OR REPLACE FUNCTION public.set_task_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_set_updated_at ON public.tasks;
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_updated_at();

CREATE TABLE IF NOT EXISTS public.subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subtasks_task_position_idx
  ON public.subtasks (task_id, position);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subtasks_owner_select ON public.subtasks;
CREATE POLICY subtasks_owner_select
  ON public.subtasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks AS task
      JOIN public.projects AS project ON project.id = task.project_id
      WHERE task.id = subtasks.task_id
        AND project.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS subtasks_owner_insert ON public.subtasks;
CREATE POLICY subtasks_owner_insert
  ON public.subtasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks AS task
      JOIN public.projects AS project ON project.id = task.project_id
      WHERE task.id = subtasks.task_id
        AND project.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS subtasks_owner_update ON public.subtasks;
CREATE POLICY subtasks_owner_update
  ON public.subtasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks AS task
      JOIN public.projects AS project ON project.id = task.project_id
      WHERE task.id = subtasks.task_id
        AND project.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks AS task
      JOIN public.projects AS project ON project.id = task.project_id
      WHERE task.id = subtasks.task_id
        AND project.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS subtasks_owner_delete ON public.subtasks;
CREATE POLICY subtasks_owner_delete
  ON public.subtasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks AS task
      JOIN public.projects AS project ON project.id = task.project_id
      WHERE task.id = subtasks.task_id
        AND project.owner_id = auth.uid()
    )
  );

-- The API verifies project ownership before calling this atomic batch operation.
CREATE OR REPLACE FUNCTION public.reorder_project_tasks(p_project_id uuid, p_moves jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  requested_count integer;
  updated_count integer;
BEGIN
  IF jsonb_typeof(p_moves) <> 'array' OR jsonb_array_length(p_moves) > 100 THEN
    RAISE EXCEPTION 'Invalid reorder payload';
  END IF;

  requested_count := jsonb_array_length(p_moves);

  UPDATE public.tasks AS task
  SET status = move.status,
      position = move.position,
      progress = CASE WHEN move.status = 'done' THEN 100 ELSE task.progress END
  FROM jsonb_to_recordset(p_moves) AS move(id uuid, status text, position double precision)
  WHERE task.id = move.id
    AND task.project_id = p_project_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> requested_count THEN
    RAISE EXCEPTION 'One or more task moves are invalid';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_project_tasks(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_project_tasks(uuid, jsonb) TO service_role;
