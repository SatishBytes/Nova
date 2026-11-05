const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');
const { authorizeProject } = require('../utils/access');
const { getProfile, recordActivity } = require('../utils/collaboration');
const { invalidateForProject, invalidateForUsers } = require('../utils/cacheInvalidation');

const createProject = async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = body.description ?? '';

  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Project name is required and must be 100 characters or fewer' });
  }

  if (typeof description !== 'string' || description.length > 500) {
    return res.status(400).json({ error: 'Description must be 500 characters or fewer' });
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name, description: description.trim(), owner_id: req.user.id }])
      .select();

    if (error) {
      logControllerError(req, 'projectController.creating_project');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    await recordActivity({
      projectId: data[0].id,
      actorId: req.user.id,
      action: 'created',
      entityType: 'project',
      entityId: data[0].id,
      meta: { name: data[0].name },
    });
    await invalidateForProject(data[0].id);
    return res.status(201).json(data[0]);
  } catch (error) {
    logControllerError(req, 'projectController.creating_project');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProjects = async (req, res) => {
  const { limit, offset, search = '' } = req.validatedQuery || { limit: 50, offset: 0 };
  try {
    const { data: ownedProjects, error: ownedError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', req.user.id)
      .is('archived_at', null);

    if (ownedError) {
      logControllerError(req, 'projectController.fetching_owned_projects');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('team_members')
      .select('project_id, role')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .in('role', ['member', 'viewer']);

    if (membershipError) {
      logControllerError(req, 'projectController.fetching_shared_project_memberships');
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
        .select('*')
        .in('id', sharedIds)
        .is('archived_at', null);
      if (error) {
        logControllerError(req, 'projectController.fetching_shared_projects');
        return res.status(500).json({ error: 'Something went wrong' });
      }
      sharedProjects = data;
    }

    const projects = [
      ...ownedProjects.map((project) => ({ ...project, role: 'owner', is_shared: false })),
      ...sharedProjects.map((project) => ({
        ...project,
        role: sharedRoles.get(project.id),
        is_shared: true,
      })),
    ];
    if (!projects.length) return res.status(200).json([]);

    const projectIds = projects.map((project) => project.id);
    const ownerIds = [...new Set(projects.map((project) => project.owner_id))];
    const [{ data: profiles, error: profilesError }, { data: members, error: membersError }, { data: activity, error: activityError }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').in('id', ownerIds),
      supabase.from('team_members').select('project_id').in('project_id', projectIds).eq('status', 'active'),
      supabase.from('activity_log').select('project_id, created_at').in('project_id', projectIds).order('created_at', { ascending: false }),
    ]);

    if (profilesError || membersError || activityError) {
      logControllerError(req, 'projectController.assembling_project_list');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const profileNames = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
    const memberCounts = new Map();
    const recentActivity = new Map();
    for (const member of members) memberCounts.set(member.project_id, (memberCounts.get(member.project_id) || 0) + 1);
    for (const entry of activity) {
      if (!recentActivity.has(entry.project_id)) recentActivity.set(entry.project_id, entry.created_at);
    }

    const response = projects.map((project) => ({
      ...project,
      owner_display_name: profileNames.get(project.owner_id) || null,
      member_count: memberCounts.get(project.id) || 0,
      recent_activity_at: recentActivity.get(project.id) || project.updated_at || project.created_at,
    })).sort((left, right) => (
      new Date(right.recent_activity_at || 0) - new Date(left.recent_activity_at || 0)
    ));

    const matching = search
      ? response.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()))
      : response;
    res.setHeader('X-Total-Count', String(matching.length));
    return res.status(200).json(matching.slice(offset, offset + limit));
  } catch (error) {
    logControllerError(req, 'projectController.fetching_projects');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProject = async (req, res) => {
  try {
    const access = await authorizeProject(req.params.id, req.user.id, 'viewer');
    if (access.status !== 200) return res.status(404).json({ error: 'Project not found' });

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .is('archived_at', null)
      .maybeSingle();

    if (error) {
      logControllerError(req, 'projectController.fetching_project');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const ownerProfile = await getProfile(data.owner_id);
    return res.status(200).json({
      ...data,
      role: access.role,
      is_shared: access.role !== 'owner',
      owner_display_name: ownerProfile?.display_name || null,
    });
  } catch (error) {
    logControllerError(req, 'projectController.fetching_project');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const updateProject = async (req, res) => {
  const body = req.body || {};
  const updates = {};

  if (Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
      return res.status(400).json({ error: 'Project name is required and must be 100 characters or fewer' });
    }
    updates.name = body.name.trim();
  }
  if (Object.hasOwn(body, 'description')) {
    if (typeof body.description !== 'string' || body.description.length > 500) {
      return res.status(400).json({ error: 'Description must be 500 characters or fewer' });
    }
    updates.description = body.description.trim();
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Provide a project name or description to update' });
  }

  try {
    const access = await authorizeProject(req.params.id, req.user.id, 'owner');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'Only the project owner can update project settings' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      logControllerError(req, 'projectController.updating_project');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Project not found' });
    await recordActivity({
      projectId: data.id,
      actorId: req.user.id,
      action: 'updated',
      entityType: 'project',
      entityId: data.id,
      meta: { name: data.name },
    });
    await invalidateForProject(data.id);
    return res.status(200).json(data);
  } catch (error) {
    logControllerError(req, 'projectController.updating_project');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const archiveProject = async (req, res) => {
  const { id } = req.params;

  try {
    const access = await authorizeProject(id, req.user.id, 'owner');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'Only the project owner can archive this project' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .is('archived_at', null)
      .select('id, name')
      .maybeSingle();

    if (error) {
      logControllerError(req, 'projectController.archiving_project');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await recordActivity({
      projectId: id,
      actorId: req.user.id,
      action: 'archived',
      entityType: 'project',
      entityId: id,
      meta: { name: data.name },
    });
    await invalidateForProject(id);
    return res.status(200).json({ message: 'Project archived' });
  } catch (error) {
    logControllerError(req, 'projectController.archiving_project');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getArchivedProjects = async (req, res) => {
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };
  try {
    const { data, error, count } = await supabase
      .from('projects')
      .select('id, name, description, archived_at', { count: 'exact' })
      .eq('owner_id', req.user.id)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logControllerError(req, 'projectController.fetching_archived_projects');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    res.setHeader('X-Total-Count', String(count ?? offset + data.length));
    return res.status(200).json(data.map((project) => ({ ...project, role: 'owner' })));
  } catch (error) {
    logControllerError(req, 'projectController.fetching_archived_projects');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const restoreProject = async (req, res) => {
  try {
    const access = await authorizeProject(req.params.id, req.user.id, 'owner', { allowArchived: true });
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'Only the project owner can restore this project' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ archived_at: null })
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .not('archived_at', 'is', null)
      .select('id, name')
      .maybeSingle();

    if (error) {
      logControllerError(req, 'projectController.restoring_project');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Archived project not found' });

    await recordActivity({
      projectId: data.id,
      actorId: req.user.id,
      action: 'restored',
      entityType: 'project',
      entityId: data.id,
      meta: { name: data.name },
    });
    await invalidateForProject(data.id);
    return res.status(200).json({ message: 'Project restored' });
  } catch (error) {
    logControllerError(req, 'projectController.restoring_project');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteProjectPermanently = async (req, res) => {
  const { id } = req.params;

  try {
    const access = await authorizeProject(id, req.user.id, 'owner', { allowArchived: true });
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'Only the project owner can permanently delete this project' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .not('archived_at', 'is', null)
      .maybeSingle();

    if (projectError) {
      logControllerError(req, 'projectController.checking_archived_project_for_deletion');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!project) return res.status(404).json({ error: 'Archived project not found' });

    const { data: members, error: membersLookupError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('project_id', id)
      .eq('status', 'active');
    if (membersLookupError) {
      logControllerError(req, 'projectController.finding_project_members_before_deletion');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { error: membersError } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', id);
    if (membersError) {
      logControllerError(req, 'projectController.removing_project_members_before_deletion');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('project_id', id);
    if (tasksError) {
      logControllerError(req, 'projectController.removing_project_tasks_before_deletion');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .not('archived_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logControllerError(req, 'projectController.deleting_archived_project');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Archived project not found' });
    await invalidateForUsers([req.user.id, ...members.map((member) => member.user_id)]);
    return res.status(200).json({ message: 'Project permanently deleted' });
  } catch (error) {
    logControllerError(req, 'projectController.deleting_archived_project');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  archiveProject,
  getArchivedProjects,
  restoreProject,
  deleteProjectPermanently,
};