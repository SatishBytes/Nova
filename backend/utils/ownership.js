const supabase = require('../config/supabaseClient');

const userOwnsProject = async (projectId, userId) => {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};

const getTaskProjectId = async (taskId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', taskId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.project_id ?? null;
};

module.exports = { userOwnsProject, getTaskProjectId };
