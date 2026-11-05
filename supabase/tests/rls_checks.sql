-- Run with a database role that can inspect public schema catalogs.
-- These checks verify policy/RLS configuration. Exercise row outcomes using
-- authenticated users for each role in a non-production test project.
DO $$
DECLARE
  expected_table text;
BEGIN
  FOREACH expected_table IN ARRAY ARRAY[
    'profiles', 'projects', 'tasks', 'subtasks',
    'team_members', 'comments', 'activity_log', 'notifications'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class AS relation
      JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
      WHERE schema.nspname = 'public'
        AND relation.relname = expected_table
        AND relation.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', expected_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks'
      AND policyname = 'tasks_read_members' AND cmd = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks'
      AND policyname = 'tasks_insert_members' AND cmd = 'INSERT'
      AND with_check LIKE '%owner%member%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members'
      AND policyname = 'team_members_insert_owner' AND cmd = 'INSERT'
      AND with_check LIKE '%owner%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects'
      AND policyname = 'projects_update_owner' AND cmd = 'UPDATE'
      AND qual LIKE '%owner_id%'
  ) THEN
    RAISE EXCEPTION 'Expected project, task, or team role policies are missing or weakened';
  END IF;
END
$$;

-- Manual behavioral checks (run as authenticated in a disposable Supabase
-- project, after setting request.jwt.claim.sub to each test user id):
-- 1. outsider: SELECT/INSERT/UPDATE/DELETE projects, tasks, comments,
--    subtasks, team_members, activity_log for another project -> no rows or
--    permission denied; notifications must be scoped to auth.uid().
-- 2. viewer: SELECT permitted; INSERT/UPDATE/DELETE tasks and comments and
--    INSERT/UPDATE team_members must affect zero rows or be denied.
-- 3. member: task/comment writes allowed; team member management and project
--    archive/update must affect zero rows or be denied.
-- 4. owner: project/task/team operations allowed within owned projects.
-- A user's own team_members row may be deleted under the explicit
-- team_members_delete_owner_or_self policy (self-leave behavior).

-- ON DELETE review: profiles cascade from auth.users; comments cascade when
-- their author profile is deleted; task comments/subtasks cascade on task
-- deletion; activity actors and invite attribution are SET NULL; notifications
-- cascade from profiles; activity cascades from projects. The base migration
-- defining projects/tasks/team_members is not in this checkout, so verify its
-- project_id foreign keys in Supabase before relying on database cascades.
-- The API explicitly removes team_members and tasks before deleting owned
-- projects. The backend holds one long-lived supabase-js service client.
