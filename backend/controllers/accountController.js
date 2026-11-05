const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');
const { invalidateForProject, invalidateForUsers } = require('../utils/cacheInvalidation');

const fetchAllRows = async (buildQuery) => {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await buildQuery().range(offset, offset + 99);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 100) return rows;
  }
};

const getExportProjectIds = async (userId) => {
  const [ownedProjects, memberships] = await Promise.all([
    fetchAllRows(() => supabase.from('projects').select('id').eq('owner_id', userId)),
    fetchAllRows(() => supabase
      .from('team_members')
      .select('project_id')
      .eq('user_id', userId)
      .eq('status', 'active')),
  ]);
  return [...new Set([...ownedProjects.map((project) => project.id), ...memberships.map((member) => member.project_id)])];
};

const removeNotificationsForEntities = async (entityIds) => {
  for (let offset = 0; offset < entityIds.length; offset += 100) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('entity_id', entityIds.slice(offset, offset + 100));
    if (error) throw error;
  }
};

const exportUserData = async (req, res) => {
  try {
    const projectIds = await getExportProjectIds(req.user.id);
    if (!projectIds.length) return res.status(200).json({ exported_at: new Date().toISOString(), projects: [], tasks: [], comments: [] });

    const projects = [];
    const tasks = [];
    for (let offset = 0; offset < projectIds.length; offset += 100) {
      const projectBatch = projectIds.slice(offset, offset + 100);
      const [projectRows, taskRows] = await Promise.all([
        fetchAllRows(() => supabase
          .from('projects')
          .select('id, name, description, created_at, updated_at')
          .in('id', projectBatch)),
        fetchAllRows(() => supabase.from('tasks').select('*').in('project_id', projectBatch)),
      ]);
      projects.push(...projectRows);
      tasks.push(...taskRows);
    }

    const taskIds = tasks.map((task) => task.id);
    const comments = [];
    for (let offset = 0; offset < taskIds.length; offset += 100) {
      comments.push(...await fetchAllRows(() => supabase
        .from('comments')
        .select('*')
        .in('task_id', taskIds.slice(offset, offset + 100))));
    }

    return res.status(200).json({
      exported_at: new Date().toISOString(),
      projects,
      tasks,
      comments,
    });
  } catch (error) {
    logControllerError(req, 'accountController.exporting_user_data');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteAccount = async (req, res) => {
  const confirmationEmail = req.body.email.trim().toLowerCase();
  if (!req.user.email || confirmationEmail !== req.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Enter the email address on your account to confirm deletion' });
  }

  try {
    const ownedProjects = await fetchAllRows(() => supabase
      .from('projects')
      .select('id')
      .eq('owner_id', req.user.id));
    const projectIds = ownedProjects.map((project) => project.id);
    const activeMemberships = await fetchAllRows(() => supabase
      .from('team_members')
      .select('project_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active'));
    const sharedProjectIds = [...new Set(
      activeMemberships.map((membership) => membership.project_id).filter((id) => !projectIds.includes(id)),
    )];
    const affectedUserIds = [req.user.id];
    const relatedEntityIds = [];
    for (const projectId of projectIds) {
      const [members, tasks] = await Promise.all([
        fetchAllRows(() => supabase.from('team_members').select('id, user_id, status').eq('project_id', projectId)),
        fetchAllRows(() => supabase.from('tasks').select('id').eq('project_id', projectId)),
      ]);
      relatedEntityIds.push(...members.map((member) => member.id), ...tasks.map((task) => task.id));
      affectedUserIds.push(...members.filter((member) => member.status === 'active').map((member) => member.user_id));

      for (let offset = 0; offset < tasks.length; offset += 100) {
        const comments = await fetchAllRows(() => supabase
          .from('comments')
          .select('id')
          .in('task_id', tasks.slice(offset, offset + 100).map((task) => task.id)));
        relatedEntityIds.push(...comments.map((comment) => comment.id));
      }

      const { error: memberError } = await supabase.from('team_members').delete().eq('project_id', projectId);
      if (memberError) throw memberError;
      const { error: taskError } = await supabase.from('tasks').delete().eq('project_id', projectId);
      if (taskError) throw taskError;
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('owner_id', req.user.id);
      if (projectError) throw projectError;
    }

    const authoredComments = await fetchAllRows(() => supabase
      .from('comments')
      .select('id')
      .eq('author_id', req.user.id));
    relatedEntityIds.push(...authoredComments.map((comment) => comment.id));
    await removeNotificationsForEntities([...new Set(relatedEntityIds)]);

    const { error: membershipsError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', req.user.id);
    if (membershipsError) throw membershipsError;

    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', req.user.id);
    if (notificationsError) throw notificationsError;

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', req.user.id);
    if (profileError) throw profileError;

    await invalidateForUsers(affectedUserIds);
    await Promise.all(sharedProjectIds.map((projectId) => invalidateForProject(projectId, [req.user.id])));

    const { error: authError } = await supabase.auth.admin.deleteUser(req.user.id);
    if (authError) throw authError;

    return res.status(200).json({ message: 'Account deleted' });
  } catch (error) {
    logControllerError(req, 'accountController.deleting_account');
    return res.status(500).json({ error: 'Unable to safely delete your account. Contact support before retrying.' });
  }
};

module.exports = { exportUserData, deleteAccount };
