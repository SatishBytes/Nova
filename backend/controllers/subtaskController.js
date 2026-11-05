const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');
const { getTaskProjectId } = require('../utils/ownership');
const { authorizeProject } = require('../utils/access');
const { recordActivity } = require('../utils/collaboration');
const { invalidateForProject } = require('../utils/cacheInvalidation');

const validateSubtaskTitle = (title) => (
  typeof title === 'string' && title.trim().length > 0 && title.trim().length <= 100
);

const createSubtask = async (req, res) => {
  const { id: taskId } = req.params;
  const { title } = req.body || {};
  if (!validateSubtaskTitle(title)) {
    return res.status(400).json({ error: 'Subtask title is required and must be 100 characters or fewer' });
  }

  try {
    const projectId = await getTaskProjectId(taskId);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Task not found' : 'You do not have permission to change this task' });
    }

    const { data: lastSubtask, error: positionError } = await supabase
      .from('subtasks')
      .select('position')
      .eq('task_id', taskId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (positionError) {
      logControllerError(req, 'subtaskController.finding_subtask_position');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data, error } = await supabase
      .from('subtasks')
      .insert([{
        task_id: taskId,
        title: title.trim(),
        position: lastSubtask ? lastSubtask.position + 1000 : 0,
      }])
      .select()
      .single();

    if (error) {
      logControllerError(req, 'subtaskController.creating_subtask');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: 'subtask_added',
      entityType: 'subtask',
      entityId: data.id,
      meta: { title: data.title, task_id: taskId },
    });
    await invalidateForProject(projectId);
    return res.status(201).json(data);
  } catch (error) {
    logControllerError(req, 'subtaskController.creating_subtask');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const updateSubtask = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const updates = {};

  if (Object.hasOwn(body, 'title')) {
    if (!validateSubtaskTitle(body.title)) {
      return res.status(400).json({ error: 'Subtask title is required and must be 100 characters or fewer' });
    }
    updates.title = body.title.trim();
  }
  if (Object.hasOwn(body, 'done')) {
    if (typeof body.done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }
    updates.done = body.done;
  }
  if (Object.hasOwn(body, 'position')) {
    if (typeof body.position !== 'number' || !Number.isFinite(body.position)) {
      return res.status(400).json({ error: 'Position must be a number' });
    }
    updates.position = body.position;
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Provide a title, done state, or position to update' });
  }

  try {
    const { data: subtask, error: lookupError } = await supabase
      .from('subtasks')
      .select('id, task_id, title, done')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      logControllerError(req, 'subtaskController.finding_subtask');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

    const projectId = await getTaskProjectId(subtask.task_id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Subtask not found' : 'You do not have permission to change this subtask' });
    }

    const { data, error } = await supabase
      .from('subtasks')
      .update(updates)
      .eq('id', id)
      .eq('task_id', subtask.task_id)
      .select()
      .maybeSingle();

    if (error) {
      logControllerError(req, 'subtaskController.updating_subtask');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Subtask not found' });
    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: Object.hasOwn(updates, 'done') && updates.done !== subtask.done ? 'subtask_toggled' : 'subtask_updated',
      entityType: 'subtask',
      entityId: data.id,
      meta: { title: data.title, task_id: subtask.task_id, done: data.done },
    });
    await invalidateForProject(projectId);
    return res.status(200).json(data);
  } catch (error) {
    logControllerError(req, 'subtaskController.updating_subtask');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteSubtask = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: subtask, error: lookupError } = await supabase
      .from('subtasks')
      .select('id, task_id, title')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      logControllerError(req, 'subtaskController.finding_subtask');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });

    const projectId = await getTaskProjectId(subtask.task_id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Subtask not found' : 'You do not have permission to change this subtask' });
    }

    const { data, error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id)
      .eq('task_id', subtask.task_id)
      .select('id')
      .maybeSingle();

    if (error) {
      logControllerError(req, 'subtaskController.deleting_subtask');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Subtask not found' });
    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: 'subtask_deleted',
      entityType: 'subtask',
      entityId: id,
      meta: { title: subtask.title, task_id: subtask.task_id },
    });
    await invalidateForProject(projectId);
    return res.status(200).json({ message: 'Subtask deleted' });
  } catch (error) {
    logControllerError(req, 'subtaskController.deleting_subtask');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { createSubtask, updateSubtask, deleteSubtask };
