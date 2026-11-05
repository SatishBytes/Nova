const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');
const { createNotification } = require('../utils/collaboration');

const getNotifications = async (req, res) => {
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };
  try {
    const today = new Date();
    const todayString = today.toISOString().slice(0, 10);
    const dueSoon = new Date(today);
    dueSoon.setDate(dueSoon.getDate() + 2);

    const [{ data: ownedProjects, error: ownedError }, { data: memberships, error: membershipError }] = await Promise.all([
      supabase
        .from('projects')
        .select('id')
        .eq('owner_id', req.user.id)
        .is('archived_at', null),
      supabase
        .from('team_members')
        .select('project_id')
        .eq('user_id', req.user.id)
        .eq('status', 'active'),
    ]);
    if (ownedError || membershipError) {
      logControllerError(req, 'notificationController.finding_active_projects_for_due_soon_notifications');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const ownedProjectIds = new Set(ownedProjects.map((project) => project.id));
    const sharedProjectIds = [...new Set(memberships.map((member) => member.project_id))]
      .filter((projectId) => !ownedProjectIds.has(projectId));
    let activeSharedIds = [];
    if (sharedProjectIds.length) {
      const { data: sharedProjects, error: sharedError } = await supabase
        .from('projects')
        .select('id')
        .in('id', sharedProjectIds)
        .is('archived_at', null);
      if (sharedError) {
        logControllerError(req, 'notificationController.finding_shared_projects_for_due_soon_notifications');
        return res.status(500).json({ error: 'Something went wrong' });
      }
      activeSharedIds = sharedProjects.map((project) => project.id);
    }

    const activeProjectIds = [...ownedProjectIds, ...activeSharedIds];
    let dueSoonTasks = [];
    if (activeProjectIds.length) {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, project_id, due_date')
        .eq('assignee_id', req.user.id)
        .in('project_id', activeProjectIds)
        .neq('status', 'done')
        .gte('due_date', todayString)
        .lte('due_date', dueSoon.toISOString().slice(0, 10));
      if (error) {
        logControllerError(req, 'notificationController.finding_due_soon_tasks');
        return res.status(500).json({ error: 'Something went wrong' });
      }
      dueSoonTasks = data;
    }

    for (const task of dueSoonTasks) {
      await createNotification({
        userId: req.user.id,
        type: 'due_soon',
        title: `"${task.title}" is due soon`,
        body: `Due ${task.due_date}.`,
        link: `/project/${task.project_id}?task=${task.id}`,
        entityId: task.id,
        date: task.due_date,
      });
    }

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      logControllerError(req, 'notificationController.fetching_notifications');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    res.setHeader('X-Total-Count', String(count ?? offset + data.length));
    return res.status(200).json(data);
  } catch (error) {
    logControllerError(req, 'notificationController.fetching_notifications');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();
    if (error) {
      logControllerError(req, 'notificationController.marking_notification_as_read');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Notification not found' });
    return res.status(200).json(data);
  } catch (error) {
    logControllerError(req, 'notificationController.marking_notification_as_read');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .is('read_at', null);
    if (error) {
      logControllerError(req, 'notificationController.marking_notifications_as_read');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    return res.status(200).json({ message: 'Notifications marked as read' });
  } catch (error) {
    logControllerError(req, 'notificationController.marking_notifications_as_read');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { getNotifications, markNotificationRead, markAllNotificationsRead };
