-- Collaboration profiles, project roles, comments, activity, notifications, and RLS.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_color text NOT NULL DEFAULT '#5146e5',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_color text NOT NULL DEFAULT '#5146e5',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.profiles (id, email, display_name)
SELECT user_record.id,
       user_record.email,
       split_part(COALESCE(user_record.email, ''), '@', 1)
FROM auth.users AS user_record
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

UPDATE public.profiles
SET avatar_color = (ARRAY['#4338ca', '#0f766e', '#a16207', '#be123c', '#0369a1', '#6d28d9'])[
  get_byte(decode(substr(md5(id::text), 1, 2), 'hex'), 0) % 6 + 1
];

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    (ARRAY['#4338ca', '#0f766e', '#a16207', '#be123c', '#0369a1', '#6d28d9'])[
      get_byte(decode(substr(md5(NEW.id::text), 1, 2), 'hex'), 0) % 6 + 1
    ]
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  INSERT INTO public.notifications (user_id, type, title, body, link, entity_id, dedupe_date)
  SELECT NEW.id,
         'invited',
         'You were invited to ' || project.name,
         'Your project role is ' || member.role || '.',
         '/project/' || project.id,
         member.id,
         current_date
  FROM public.team_members AS member
  JOIN public.projects AS project ON project.id = member.project_id
  WHERE lower(member.email) = lower(NEW.email)
    AND member.user_id IS NULL
    AND member.status = 'pending'
  ON CONFLICT (user_id, type, entity_id, dedupe_date) DO NOTHING;

  UPDATE public.team_members
  SET user_id = NEW.id,
      status = 'active'
  WHERE lower(email) = lower(NEW.email)
    AND user_id IS NULL
    AND status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.team_members
  ALTER COLUMN user_id DROP NOT NULL;

UPDATE public.team_members
SET status = CASE WHEN user_id IS NULL THEN 'pending' ELSE 'active' END
WHERE status IS NULL
   OR (user_id IS NULL AND status <> 'pending')
   OR (user_id IS NOT NULL AND status <> 'active');

UPDATE public.team_members AS member
SET user_id = profile.id,
    status = 'active'
FROM public.profiles AS profile
WHERE member.user_id IS NULL
  AND member.status = 'pending'
  AND lower(member.email) = lower(profile.email);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.team_members'::regclass
      AND conname = 'team_members_role_check'
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_role_check
      CHECK (role IN ('owner', 'member', 'viewer'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.team_members'::regclass
      AND conname = 'team_members_status_check'
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_status_check
      CHECK (status IN ('pending', 'active'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.team_members'::regclass
      AND conname = 'team_members_invited_by_fkey'
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_invited_by_fkey
      FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Keep an existing active row when historical team data contains duplicate emails.
WITH duplicate_members AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY project_id, lower(email)
           ORDER BY (status = 'active') DESC, created_at, id
         ) AS row_number
  FROM public.team_members
  WHERE email IS NOT NULL
)
DELETE FROM public.team_members AS member
USING duplicate_members
WHERE member.id = duplicate_members.id
  AND duplicate_members.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_project_email_unique
  ON public.team_members (project_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_members_user_status_idx
  ON public.team_members (user_id, status);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass
      AND conname = 'tasks_assignee_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_assignee_id_fkey
      FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

CREATE INDEX IF NOT EXISTS comments_task_created_idx
  ON public.comments (task_id, created_at);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_project_created_idx
  ON public.activity_log (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('assigned', 'mention', 'due_soon', 'invited')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '/',
  entity_id uuid,
  dedupe_date date,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_unique
  ON public.notifications (user_id, type, entity_id, dedupe_date);
CREATE INDEX IF NOT EXISTS notifications_user_read_created_idx
  ON public.notifications (user_id, read_at, created_at DESC);

CREATE OR REPLACE FUNCTION public.project_role(project_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.projects AS project
      WHERE project.id = $1 AND project.owner_id = auth.uid()
    ) THEN 'owner'
    ELSE (
      SELECT member.role
      FROM public.team_members AS member
      WHERE member.project_id = $1
        AND member.user_id = auth.uid()
        AND member.status = 'active'
        AND member.role IN ('member', 'viewer')
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_task_assignee_project_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.projects AS project
      WHERE project.id = NEW.project_id
        AND project.owner_id = NEW.assignee_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.team_members AS member
      WHERE member.project_id = NEW.project_id
        AND member.user_id = NEW.assignee_id
        AND member.status = 'active'
        AND member.role IN ('member', 'viewer')
    )
  THEN
    RAISE EXCEPTION 'Task assignee must be an active project member';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_validate_assignee ON public.tasks;
CREATE TRIGGER tasks_validate_assignee
  BEFORE INSERT OR UPDATE OF assignee_id, project_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_assignee_project_member();

CREATE OR REPLACE FUNCTION public.is_project_member(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.project_role($1) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.team_members AS target_member
      WHERE target_member.user_id = profile_id
        AND target_member.status = 'active'
        AND public.is_project_member(target_member.project_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects AS project
      JOIN public.tasks AS task ON task.project_id = project.id
      WHERE task.assignee_id = profile_id
        AND public.is_project_member(project.id)
    );
$$;

CREATE OR REPLACE FUNCTION public.set_comment_edited_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.edited_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_set_edited_at ON public.comments;
CREATE TRIGGER comments_set_edited_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_comment_edited_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_read_shared ON public.profiles;
CREATE POLICY profiles_read_shared
  ON public.profiles FOR SELECT TO authenticated
  USING (public.can_view_profile(id));

DROP POLICY IF EXISTS projects_read_members ON public.projects;
CREATE POLICY projects_read_members
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id));
DROP POLICY IF EXISTS projects_insert_owner ON public.projects;
CREATE POLICY projects_insert_owner
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS projects_update_owner ON public.projects;
CREATE POLICY projects_update_owner
  ON public.projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS projects_delete_owner ON public.projects;
CREATE POLICY projects_delete_owner
  ON public.projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS tasks_read_members ON public.tasks;
CREATE POLICY tasks_read_members
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
DROP POLICY IF EXISTS tasks_insert_members ON public.tasks;
CREATE POLICY tasks_insert_members
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.project_role(project_id) IN ('owner', 'member'));
DROP POLICY IF EXISTS tasks_update_members ON public.tasks;
CREATE POLICY tasks_update_members
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.project_role(project_id) IN ('owner', 'member'))
  WITH CHECK (public.project_role(project_id) IN ('owner', 'member'));
DROP POLICY IF EXISTS tasks_delete_members ON public.tasks;
CREATE POLICY tasks_delete_members
  ON public.tasks FOR DELETE TO authenticated
  USING (public.project_role(project_id) IN ('owner', 'member'));

DROP POLICY IF EXISTS subtasks_owner_select ON public.subtasks;
DROP POLICY IF EXISTS subtasks_owner_insert ON public.subtasks;
DROP POLICY IF EXISTS subtasks_owner_update ON public.subtasks;
DROP POLICY IF EXISTS subtasks_owner_delete ON public.subtasks;
DROP POLICY IF EXISTS subtasks_read_members ON public.subtasks;
CREATE POLICY subtasks_read_members
  ON public.subtasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = subtasks.task_id
        AND public.is_project_member(task.project_id)
    )
  );
DROP POLICY IF EXISTS subtasks_write_members ON public.subtasks;
CREATE POLICY subtasks_write_members
  ON public.subtasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = subtasks.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    )
  );
DROP POLICY IF EXISTS subtasks_update_members ON public.subtasks;
CREATE POLICY subtasks_update_members
  ON public.subtasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = subtasks.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = subtasks.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    )
  );
DROP POLICY IF EXISTS subtasks_delete_members ON public.subtasks;
CREATE POLICY subtasks_delete_members
  ON public.subtasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = subtasks.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    )
  );

DROP POLICY IF EXISTS team_members_read_members ON public.team_members;
CREATE POLICY team_members_read_members
  ON public.team_members FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
DROP POLICY IF EXISTS team_members_insert_owner ON public.team_members;
CREATE POLICY team_members_insert_owner
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.project_role(project_id) = 'owner');
DROP POLICY IF EXISTS team_members_update_owner ON public.team_members;
CREATE POLICY team_members_update_owner
  ON public.team_members FOR UPDATE TO authenticated
  USING (public.project_role(project_id) = 'owner')
  WITH CHECK (public.project_role(project_id) = 'owner');
DROP POLICY IF EXISTS team_members_delete_owner_or_self ON public.team_members;
CREATE POLICY team_members_delete_owner_or_self
  ON public.team_members FOR DELETE TO authenticated
  USING (public.project_role(project_id) = 'owner' OR user_id = auth.uid());

DROP POLICY IF EXISTS comments_read_members ON public.comments;
CREATE POLICY comments_read_members
  ON public.comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.is_project_member(task.project_id)
    )
  );
DROP POLICY IF EXISTS comments_insert_members ON public.comments;
CREATE POLICY comments_insert_members
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    )
  );
DROP POLICY IF EXISTS comments_update_author_or_owner ON public.comments;
CREATE POLICY comments_update_author_or_owner
  ON public.comments FOR UPDATE TO authenticated
  USING (
    (author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    ))
    OR EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) = 'owner'
    )
  )
  WITH CHECK (
    (author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    ))
    OR EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) = 'owner'
    )
  );
DROP POLICY IF EXISTS comments_delete_author_or_owner ON public.comments;
CREATE POLICY comments_delete_author_or_owner
  ON public.comments FOR DELETE TO authenticated
  USING (
    (author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) IN ('owner', 'member')
    ))
    OR EXISTS (
      SELECT 1 FROM public.tasks AS task
      WHERE task.id = comments.task_id
        AND public.project_role(task.project_id) = 'owner'
    )
  );

DROP POLICY IF EXISTS activity_log_read_members ON public.activity_log;
CREATE POLICY activity_log_read_members
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
DROP POLICY IF EXISTS activity_log_insert_members ON public.activity_log;
CREATE POLICY activity_log_insert_members
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.project_role(project_id) IN ('owner', 'member'));

DROP POLICY IF EXISTS notifications_read_self ON public.notifications;
CREATE POLICY notifications_read_self
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_insert_self ON public.notifications;
CREATE POLICY notifications_insert_self
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update_self ON public.notifications;
CREATE POLICY notifications_update_self
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_delete_self ON public.notifications;
CREATE POLICY notifications_delete_self
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END
$$;
