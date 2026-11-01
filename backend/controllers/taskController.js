const supabase = require('../config/supabaseClient');
const { userOwnsProject, getTaskProjectId } = require('../utils/ownership');

const createTask = async (req, res) => {
  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const { project_id, assignee_id } = body;

  if (!title || title.length > 100 || !project_id) {
    return res.status(400).json({ error: 'Task title and project_id are required; title must be 100 characters or fewer' });
  }

  try {
    if (!(await userOwnsProject(project_id, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ title, project_id, assignee_id }])
      .select();

    if (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTasksByProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    if (!(await userOwnsProject(projectId, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status, progress } = req.body || {};

  if (status !== undefined && !['todo', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status must be todo, in_progress, or done' });
  }

  if (progress !== undefined && (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 100)) {
    return res.status(400).json({ error: 'Progress must be a number between 0 and 100' });
  }

  if (status === undefined && progress === undefined) {
    return res.status(400).json({ error: 'Provide a status or progress to update' });
  }

  try {
    const projectId = await getTaskProjectId(id);
    if (!projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!(await userOwnsProject(projectId, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (progress !== undefined) updateData.progress = progress;
    if (status === 'done') updateData.progress = 100;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteTask = async (req, res) => {
  const { id } = req.params;

  try {
    const projectId = await getTaskProjectId(id);
    if (!projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!(await userOwnsProject(projectId, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { createTask, getTasksByProject, updateTaskStatus, deleteTask };