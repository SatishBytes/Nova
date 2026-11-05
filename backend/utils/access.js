const supabase = require('../config/supabaseClient');

const ROLE_LEVEL = { viewer: 1, member: 2, owner: 3 };

const getProjectRole = async (projectId, userId, { allowArchived = false } = {}) => {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('owner_id, archived_at')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) return null;
  if (project.archived_at && !allowArchived) return null;
  if (project.owner_id === userId) return 'owner';

  const { data: membership, error: memberError } = await supabase
    .from('team_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['member', 'viewer'])
    .maybeSingle();

  if (memberError) throw memberError;
  return membership?.role || null;
};

const requireRole = (minimumRole) => (role) => (
  Boolean(role) && ROLE_LEVEL[role] >= ROLE_LEVEL[minimumRole]
);

const authorizeProject = async (projectId, userId, minimumRole, options) => {
  const role = await getProjectRole(projectId, userId, options);
  if (!role) return { role: null, status: 404 };
  if (!requireRole(minimumRole)(role)) return { role, status: 403 };
  return { role, status: 200 };
};

module.exports = { getProjectRole, requireRole, authorizeProject };
