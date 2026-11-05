const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');
const { getTaskProjectId } = require('../utils/ownership');
const { authorizeProject } = require('../utils/access');
const { createNotification, recordActivity } = require('../utils/collaboration');
const { invalidateForProject } = require('../utils/cacheInvalidation');

const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TASK_FIELDS = ['title', 'description', 'status', 'priority', 'due_date', 'labels', 'progress', 'position', 'assignee_id'];

const validateTaskFields = (body, { creating = false } = {}) => {
  const updates = {};

  if (creating || Object.hasOwn(body, 'title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 100) return { error: 'Task title is required and must be 100 characters or fewer' };
    updates.title = title;
  }

  if (Object.hasOwn(body, 'description')) {
    if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 500)) {
      return { error: 'Description must be 500 characters or fewer' };
    }
    updates.description = body.description;
  }

  if (Object.hasOwn(body, 'status')) {
    if (!TASK_STATUSES.includes(body.status)) {
      return { error: 'Status must be todo, in_progress, or done' };
    }
    updates.status = body.status;
  }

  if (Object.hasOwn(body, 'priority')) {
    if (!TASK_PRIORITIES.includes(body.priority)) {
      return { error: 'Priority must be low, medium, high, or urgent' };
    }
    updates.priority = body.priority;
  }

  if (Object.hasOwn(body, 'due_date')) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (body.due_date !== null) {
      const parsed = typeof body.due_date === 'string' && datePattern.test(body.due_date)
        ? new Date(`${body.due_date}T00:00:00.000Z`)
        : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.due_date) {
        return { error: 'Due date must be a valid ISO date or null' };
      }
    }
    updates.due_date = body.due_date;
  }

  if (Object.hasOwn(body, 'labels')) {
    if (
      !Array.isArray(body.labels)
      || body.labels.length > 10
      || body.labels.some((label) => typeof label !== 'string' || !label.trim() || label.trim().length > 20)
    ) {
      return { error: 'Labels must contain up to 10 non-empty values of 20 characters or fewer' };
    }
    updates.labels = body.labels.map((label) => label.trim());
  }

  if (Object.hasOwn(body, 'progress')) {
    if (typeof body.progress !== 'number' || !Number.isFinite(body.progress) || body.progress < 0 || body.progress > 100) {
      return { error: 'Progress must be a number between 0 and 100' };
    }
    updates.progress = body.progress;
  }

  if (Object.hasOwn(body, 'position')) {
    if (typeof body.position !== 'number' || !Number.isFinite(body.position)) {
      return { error: 'Position must be a number' };
    }
    updates.position = body.position;
  }

  if (Object.hasOwn(body, 'assignee_id')) {
    if (body.assignee_id !== null && (typeof body.assignee_id !== 'string' || !body.assignee_id.trim())) {
      return { error: 'assignee_id must be a user id or null' };
    }
    updates.assignee_id = body.assignee_id;
  }

  return { updates };
};

const isProjectAssignee = async (projectId, userId) => {
  if (userId === null) return true;
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return false;
  if (project.owner_id === userId) return true;

  const { data: membership, error } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['member', 'viewer'])
    .maybeSingle();
  if (error) throw error;
  return Boolean(membership);
};

const getNextPosition = async (projectId, status) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('position')
    .eq('project_id', projectId)
    .eq('status', status)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? data.position + 1000 : 0;
};

const createTask = async (req, res) => {
  const body = req.body || {};
  const { project_id: projectId, assignee_id: assigneeId } = body;
  const validation = validateTaskFields(body, { creating: true });

  if (validation.error) return res.status(400).json({ error: validation.error });
  if (!projectId) return res.status(400).json({ error: 'project_id is required' });

  try {
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'You do not have permission to create tasks' });
    }
    if (assigneeId !== undefined && !(await isProjectAssignee(projectId, assigneeId))) {
      return res.status(400).json({ error: 'Assignee must be an active project member' });
    }

    const updates = validation.updates;
    const status = updates.status || 'todo';
    const position = updates.position ?? await getNextPosition(projectId, status);
    if (status === 'done') updates.progress = 100;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        ...updates,
        status,
        position,
        project_id: projectId,
        ...(assigneeId !== undefined ? { assignee_id: assigneeId } : {}),
      }])
      .select()
      .single();

    if (error) {
      logControllerError(req, 'taskController.creating_task');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: 'created',
      entityType: 'task',
      entityId: data.id,
      meta: { title: data.title },
    });
    if (data.assignee_id && data.assignee_id !== req.user.id) {
      await createNotification({
        userId: data.assignee_id,
        type: 'assigned',
        title: `You were assigned "${data.title}"`,
        body: 'A project task was assigned to you.',
        link: `/project/${projectId}?task=${data.id}`,
        entityId: data.id,
      });
    }
    await invalidateForProject(projectId);

    return res.status(201).json({ ...data, subtask_counts: { done: 0, total: 0 }, subtasks: [] });
  } catch (error) {
    logControllerError(req, 'taskController.creating_task');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTasksByProject = async (req, res) => {
  const { projectId } = req.params;
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };

  try {
    const access = await authorizeProject(projectId, req.user.id, 'viewer');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'You do not have permission to read these tasks' });
    }

    const { data: tasks, error, count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('status', { ascending: true })
      .order('position', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logControllerError(req, 'taskController.fetching_tasks');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    res.setHeader('X-Total-Count', String(count ?? offset + tasks.length));
    if (!tasks.length) return res.status(200).json([]);

    const taskIds = tasks.map((task) => task.id);
    const assigneeIds = [...new Set(tasks.map((task) => task.assignee_id).filter(Boolean))];
    const [{ data: subtasks, error: subtasksError }, { data: assignees, error: assigneesError }] = await Promise.all([
      supabase.from('subtasks').select('*').in('task_id', taskIds).order('position', { ascending: true }),
      assigneeIds.length
        ? supabase.from('profiles').select('id, email, display_name, avatar_color').in('id', assigneeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (subtasksError || assigneesError) {
      logControllerError(req, 'taskController.fetching_task_collaboration_details');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const subtasksByTask = new Map(taskIds.map((id) => [id, []]));
    for (const subtask of subtasks) {
      subtasksByTask.get(subtask.task_id)?.push(subtask);
    }

    const statusOrder = { todo: 0, in_progress: 1, done: 2 };
    const assigneeById = new Map(assignees.map((profile) => [profile.id, profile]));
    const result = tasks
      .map((task) => {
        const taskSubtasks = subtasksByTask.get(task.id) || [];
        return {
          ...task,
          assignee: assigneeById.get(task.assignee_id) || null,
          subtasks: taskSubtasks,
          subtask_counts: {
            done: taskSubtasks.filter((subtask) => subtask.done).length,
            total: taskSubtasks.length,
          },
        };
      })
      .sort((left, right) => (
        (statusOrder[left.status] ?? 3) - (statusOrder[right.status] ?? 3)
        || left.position - right.position
      ));

    return res.status(200).json(result);
  } catch (error) {
    logControllerError(req, 'taskController.fetching_tasks');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const updateTask = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const validation = validateTaskFields(body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const updates = validation.updates;
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: `Provide at least one of: ${TASK_FIELDS.join(', ')}` });
  }

  try {
    const projectId = await getTaskProjectId(id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });

    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Task not found' : 'You do not have permission to edit tasks' });
    }

    const { data: existingTask, error: existingError } = await supabase
      .from('tasks')
      .select('id, title, status, assignee_id')
      .eq('id', id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (existingError) {
      logControllerError(req, 'taskController.reading_task_before_update');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    if (
      Object.hasOwn(updates, 'assignee_id')
      && updates.assignee_id !== null
      && !(await isProjectAssignee(projectId, updates.assignee_id))
    ) {
      return res.status(400).json({ error: 'Assignee must be an active project member' });
    }
    if (updates.status === 'done') updates.progress = 100;

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      logControllerError(req, 'taskController.updating_task');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) return res.status(404).json({ error: 'Task not found' });
    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: existingTask.status !== data.status ? 'moved' : 'updated',
      entityType: 'task',
      entityId: data.id,
      meta: {
        title: data.title,
        from_status: existingTask.status,
        to_status: data.status,
      },
    });
    if (data.assignee_id && data.assignee_id !== existingTask.assignee_id && data.assignee_id !== req.user.id) {
      await createNotification({
        userId: data.assignee_id,
        type: 'assigned',
        title: `You were assigned "${data.title}"`,
        body: 'A project task was assigned to you.',
        link: `/project/${projectId}?task=${data.id}`,
        entityId: data.id,
      });
    }
    await invalidateForProject(projectId);
    let responseTask = data;
    if (Object.hasOwn(updates, 'assignee_id')) {
      if (data.assignee_id) {
        const { data: assignee, error: assigneeError } = await supabase
          .from('profiles')
          .select('id, email, display_name, avatar_color')
          .eq('id', data.assignee_id)
          .maybeSingle();
        if (assigneeError) {
          logControllerError(req, 'taskController.fetching_updated_task_assignee', 200);
        }
        responseTask = { ...data, assignee: assignee || null };
      } else {
        responseTask = { ...data, assignee: null };
      }
    }
    return res.status(200).json(responseTask);
  } catch (error) {
    logControllerError(req, 'taskController.updating_task');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const reorderTasks = async (req, res) => {
  const body = req.body || {};
  const { project_id: projectId, moves } = body;

  if (!projectId || !Array.isArray(moves) || moves.length > 100) {
    return res.status(400).json({ error: 'project_id and up to 100 moves are required' });
  }

  const ids = new Set();
  for (const move of moves) {
    if (
      !move
      || typeof move.id !== 'string'
      || ids.has(move.id)
      || !TASK_STATUSES.includes(move.status)
      || typeof move.position !== 'number'
      || !Number.isFinite(move.position)
    ) {
      return res.status(400).json({ error: 'Each move must have a unique task id, valid status, and numeric position' });
    }
    ids.add(move.id);
  }

  try {
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'You do not have permission to reorder tasks' });
    }

    if (moves.length === 0) return res.status(200).json({ message: 'Tasks reordered' });

    const { data: tasks, error: lookupError } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('project_id', projectId)
      .in('id', [...ids]);

    if (lookupError) {
      logControllerError(req, 'taskController.verifying_reorder_tasks');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (tasks.length !== moves.length) {
      return res.status(404).json({ error: 'One or more tasks were not found in this project' });
    }

    const { error } = await supabase.rpc('reorder_project_tasks', {
      p_project_id: projectId,
      p_moves: moves,
    });

    if (error) {
      logControllerError(req, 'taskController.reordering_tasks');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const statusById = new Map(tasks.map((task) => [task.id, task]));
    for (const move of moves) {
      const task = statusById.get(move.id);
      if (task && task.status !== move.status) {
        await recordActivity({
          projectId,
          actorId: req.user.id,
          action: 'moved',
          entityType: 'task',
          entityId: task.id,
          meta: { title: task.title, from_status: task.status, to_status: move.status },
        });
      }
    }

    await invalidateForProject(projectId);
    return res.status(200).json({ message: 'Tasks reordered' });
  } catch (error) {
    logControllerError(req, 'taskController.reordering_tasks');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteTask = async (req, res) => {
  const { id } = req.params;

  try {
    const projectId = await getTaskProjectId(id);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });

    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Task not found' : 'You do not have permission to delete tasks' });
    }

    const { data: existingTask, error: existingError } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', id)
      .maybeSingle();
    if (existingError) {
      logControllerError(req, 'taskController.reading_task_before_deletion');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('id')
      .maybeSingle();

    if (error) {
      logControllerError(req, 'taskController.deleting_task');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Task not found' });
    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: 'deleted',
      entityType: 'task',
      entityId: id,
      meta: { title: existingTask?.title || 'Task' },
    });
    await invalidateForProject(projectId);
    return res.status(200).json({ message: 'Task deleted' });
  } catch (error) {
    logControllerError(req, 'taskController.deleting_task');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { createTask, getTasksByProject, updateTask, reorderTasks, deleteTask };
