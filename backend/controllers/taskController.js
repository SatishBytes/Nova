const supabase = require('../config/supabaseClient');

const createTask = async (req, res) => {
  const { title, project_id, assignee_id } = req.body;

  if (!title || !project_id) {
    return res.status(400).json({ error: 'Title and project_id are required' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ title, project_id, assignee_id }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data[0]);
};

const getTasksByProject = async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
};

const updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, progress } = req.body;

  console.log('Received update:', { id, status, progress });

  const updateData = {};
  if (status !== undefined) updateData.status = status;
  if (progress !== undefined) updateData.progress = progress;

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .select();

  if (error) {
    console.log('Supabase update error:', error);
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data[0]);
};

const deleteTask = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ message: 'Task deleted' });
};

module.exports = { createTask, getTasksByProject, updateTaskStatus, deleteTask };