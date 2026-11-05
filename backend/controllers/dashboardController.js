const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');

const getDashboardSummary = async (req, res) => {
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };
  try {
    const [{ data: ownedProjects, error: ownedError }, { data: memberships, error: membershipError }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, owner_id')
        .eq('owner_id', req.user.id)
        .is('archived_at', null),
      supabase
        .from('team_members')
        .select('project_id, role')
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .in('role', ['member', 'viewer']),
    ]);

    if (ownedError || membershipError) {
      logControllerError(req, 'dashboardController.fetching_dashboard_projects');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const ownedIds = new Set(ownedProjects.map((project) => project.id));
    const sharedRoles = new Map(
      memberships
        .filter((membership) => !ownedIds.has(membership.project_id))
        .map((membership) => [membership.project_id, membership.role]),
    );
    const sharedIds = [...sharedRoles.keys()];
    let sharedProjects = [];

    if (sharedIds.length) {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, owner_id')
        .in('id', sharedIds)
        .is('archived_at', null);
      if (error) {
        logControllerError(req, 'dashboardController.fetching_shared_dashboard_projects');
        return res.status(500).json({ error: 'Something went wrong' });
      }
      sharedProjects = data;
    }

    const projects = [
      ...ownedProjects.map((project) => ({ ...project, role: 'owner' })),
      ...sharedProjects.map((project) => ({ ...project, role: sharedRoles.get(project.id) })),
    ];

    if (!projects.length) {
      return res.status(200).json({
        stats: { total_projects: 0, open_tasks: 0, due_this_week: 0, completed_this_week: 0, total_tasks: 0 },
        my_tasks: [],
        completions: [],
        project_progress: [],
        has_team_members: false,
      });
    }

    const projectIds = projects.map((project) => project.id);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 13);
    since.setUTCHours(0, 0, 0, 0);

    const [{ data: tasks, error: tasksError }, { data: activity, error: activityError }, { data: members, error: membersError }] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, project_id, title, status, priority, due_date, assignee_id, updated_at, created_at')
        .in('project_id', projectIds),
      supabase
        .from('activity_log')
        .select('project_id, created_at, meta')
        .in('project_id', projectIds)
        .eq('action', 'moved')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true }),
      supabase
        .from('team_members')
        .select('project_id')
        .in('project_id', projectIds)
        .eq('status', 'active'),
    ]);

    if (tasksError || activityError || membersError) {
      logControllerError(req, 'dashboardController.assembling_dashboard_summary');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const projectById = new Map(projects.map((project) => [project.id, project]));
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const weekStart = new Date(todayUtc);
    const dayOfWeek = (weekStart.getUTCDay() + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const completionCounts = new Map();
    for (let offset = 0; offset < 14; offset += 1) {
      const date = new Date(since);
      date.setUTCDate(date.getUTCDate() + offset);
      completionCounts.set(date.toISOString().slice(0, 10), 0);
    }

    for (const entry of activity) {
      if (entry.meta?.to_status !== 'done') continue;
      const date = entry.created_at.slice(0, 10);
      if (completionCounts.has(date)) completionCounts.set(date, completionCounts.get(date) + 1);
    }

    const tasksByProject = new Map(projectIds.map((id) => [id, []]));
    for (const task of tasks) tasksByProject.get(task.project_id)?.push(task);

    const myTasks = tasks
      .filter((task) => task.assignee_id === req.user.id && task.status !== 'done')
      .map((task) => ({
        ...task,
        project_name: projectById.get(task.project_id)?.name || 'Project',
        role: projectById.get(task.project_id)?.role,
      }))
      .sort((left, right) => (
        (left.due_date || '9999-12-31').localeCompare(right.due_date || '9999-12-31')
        || left.title.localeCompare(right.title)
      ));

    const completedThisWeek = activity.filter((entry) => (
      entry.meta?.to_status === 'done'
      && new Date(entry.created_at) >= weekStart
      && new Date(entry.created_at) < weekEnd
    )).length;

    return res.status(200).json({
      stats: {
        total_projects: projects.length,
        open_tasks: tasks.filter((task) => task.status !== 'done').length,
        due_this_week: tasks.filter((task) => (
          task.status !== 'done'
          && task.due_date
          && task.due_date >= todayUtc.toISOString().slice(0, 10)
          && task.due_date < weekEnd.toISOString().slice(0, 10)
        )).length,
        completed_this_week: completedThisWeek,
        total_tasks: tasks.length,
      },
      my_tasks: myTasks.slice(offset, offset + limit),
      my_tasks_total: myTasks.length,
      completions: [...completionCounts].map(([date, count]) => ({ date, count })),
      project_progress: projects.map((project) => {
        const projectTasks = tasksByProject.get(project.id) || [];
        const done = projectTasks.filter((task) => task.status === 'done').length;
        return {
          id: project.id,
          name: project.name,
          role: project.role,
          total: projectTasks.length,
          done,
          progress: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
        };
      }),
      has_team_members: members.length > 0,
    });
  } catch (error) {
    logControllerError(req, 'dashboardController.fetching_dashboard_summary');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { getDashboardSummary };
