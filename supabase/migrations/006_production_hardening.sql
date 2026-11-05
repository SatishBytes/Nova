-- Speeds up membership checks by project and user, including active-role lookups.
CREATE INDEX IF NOT EXISTS team_members_project_user_status_idx
  ON public.team_members (project_id, user_id, status);

-- Supports assignee task lists and due-soon filtering.
CREATE INDEX IF NOT EXISTS tasks_assignee_status_due_date_idx
  ON public.tasks (assignee_id, status, due_date)
  WHERE assignee_id IS NOT NULL;

-- Supports profile deletion's SET NULL action for task assignees and activity actors.
CREATE INDEX IF NOT EXISTS activity_log_actor_id_idx
  ON public.activity_log (actor_id)
  WHERE actor_id IS NOT NULL;

-- Supports profile deletion's comment-author cascade and invited_by SET NULL action.
CREATE INDEX IF NOT EXISTS comments_author_id_idx
  ON public.comments (author_id);

CREATE INDEX IF NOT EXISTS team_members_invited_by_idx
  ON public.team_members (invited_by)
  WHERE invited_by IS NOT NULL;

-- Supports notification pages ordered newest-first for a user.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Supports case-insensitive invite lookup by profile email.
CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;
