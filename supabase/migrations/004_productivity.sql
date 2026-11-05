-- Add reversible project archiving for the productivity dashboard.
-- The owner-only projects UPDATE policy from 003_collaboration.sql also protects archived_at.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS projects_owner_archived_idx
  ON public.projects (owner_id, archived_at);
