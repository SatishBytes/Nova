const { logControllerError } = require('../utils/logger');
const supabase = require('../config/supabaseClient');
const { authorizeProject } = require('../utils/access');
const { createNotification, recordActivity } = require('../utils/collaboration');
const { invalidateForProject } = require('../utils/cacheInvalidation');

const TEAM_ROLES = ['member', 'viewer'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addTeamMember = async (req, res) => {
  const { project_id: projectId, email: rawEmail, role = 'member' } = req.body || {};
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!projectId || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'A project_id and valid email are required' });
  }
  if (!TEAM_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be member or viewer' });
  }
  if (req.user.email?.toLowerCase() === email) {
    return res.status(400).json({ error: 'You cannot invite yourself' });
  }

  try {
    const access = await authorizeProject(projectId, req.user.id, 'owner');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Project not found' : 'Only the project owner can invite members' });
    }

    const { data: existingMember, error: existingError } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('email', email)
      .maybeSingle();
    if (existingError) {
      logControllerError(req, 'teamController.checking_for_duplicate_team_member');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (existingMember) {
      return res.status(409).json({ error: 'This email is already invited to the project' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', email)
      .maybeSingle();
    if (profileError) {
      logControllerError(req, 'teamController.looking_up_invitee_profile');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) {
      logControllerError(req, 'teamController.fetching_project_for_invite');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { data, error } = await supabase
      .from('team_members')
      .insert([{
        project_id: projectId,
        user_id: profile?.id || null,
        email,
        role,
        status: profile ? 'active' : 'pending',
        invited_by: req.user.id,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This email is already invited to the project' });
      }
      logControllerError(req, 'teamController.adding_team_member');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: 'invited',
      entityType: 'team_member',
      entityId: data.id,
      meta: { email, role },
    });
    if (profile) {
      await createNotification({
        userId: profile.id,
        type: 'invited',
        title: `You were invited to ${project.name}`,
        body: `Your project role is ${role}.`,
        link: `/project/${projectId}`,
        entityId: data.id,
      });
    }

    await invalidateForProject(projectId, profile ? [profile.id] : []);
    return res.status(201).json({ ...data, profile: profile || null });
  } catch (error) {
    logControllerError(req, 'teamController.adding_team_member');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTeamMembers = async (req, res) => {
  const { projectId } = req.params;
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };

  try {
    const access = await authorizeProject(projectId, req.user.id, 'viewer');
    if (access.status !== 200) return res.status(404).json({ error: 'Project not found' });

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) {
      logControllerError(req, 'teamController.fetching_project_owner');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { data: members, error, count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logControllerError(req, 'teamController.fetching_team_members');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const visibleMembers = members.filter((member) => member.user_id !== project.owner_id);
    const userIds = [...new Set([project.owner_id, ...members.map((member) => member.user_id).filter(Boolean)])];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_color')
      .in('id', userIds);
    if (profilesError) {
      logControllerError(req, 'teamController.fetching_team_member_profiles');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    res.setHeader('X-Total-Count', String(count ?? offset + members.length));
    return res.status(200).json([
      {
        id: `owner-${project.owner_id}`,
        user_id: project.owner_id,
        email: profileById.get(project.owner_id)?.email || null,
        role: 'owner',
        status: 'active',
        profile: profileById.get(project.owner_id) || null,
        is_owner: true,
      },
      ...visibleMembers.map((member) => ({
        ...member,
        profile: profileById.get(member.user_id) || null,
        is_owner: false,
      })),
    ]);
  } catch (error) {
    logControllerError(req, 'teamController.fetching_team_members');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const updateTeamMember = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!TEAM_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be member or viewer' });
  }

  try {
    const { data: member, error: lookupError } = await supabase
      .from('team_members')
      .select('id, project_id, user_id, role')
      .eq('id', id)
      .maybeSingle();
    if (lookupError) {
      logControllerError(req, 'teamController.finding_team_member');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!member) return res.status(404).json({ error: 'Team member not found' });

    const access = await authorizeProject(member.project_id, req.user.id, 'owner');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Team member not found' : 'Only the project owner can change member roles' });
    }

    const { data, error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', id)
      .eq('project_id', member.project_id)
      .select()
      .maybeSingle();
    if (error) {
      logControllerError(req, 'teamController.updating_team_member_role');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Team member not found' });

    await recordActivity({
      projectId: member.project_id,
      actorId: req.user.id,
      action: 'role_changed',
      entityType: 'team_member',
      entityId: member.id,
      meta: { from_role: member.role, to_role: role },
    });
    await invalidateForProject(member.project_id, member.user_id ? [member.user_id] : []);
    return res.status(200).json(data);
  } catch (error) {
    logControllerError(req, 'teamController.updating_team_member_role');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const removeMember = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: member, error: lookupError } = await supabase
      .from('team_members')
      .select('id, project_id, user_id, email')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      logControllerError(req, 'teamController.finding_team_member');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!member) return res.status(404).json({ error: 'Team member not found' });

    const access = await authorizeProject(member.project_id, req.user.id, 'viewer');
    if (access.status !== 200) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    if (access.role === 'owner' && member.user_id === req.user.id) {
      return res.status(403).json({ error: 'Project owners cannot remove themselves' });
    }
    if (access.role !== 'owner' && member.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only leave a project yourself' });
    }

    const { data, error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('project_id', member.project_id)
      .select('id')
      .maybeSingle();

    if (error) {
      logControllerError(req, 'teamController.removing_team_member');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!data) return res.status(404).json({ error: 'Team member not found' });

    await recordActivity({
      projectId: member.project_id,
      actorId: req.user.id,
      action: access.role === 'owner' ? 'member_removed' : 'member_left',
      entityType: 'team_member',
      entityId: member.id,
      meta: { email: member.email },
    });
    await invalidateForProject(member.project_id, member.user_id ? [member.user_id] : []);
    return res.status(200).json({ message: 'Member removed' });
  } catch (error) {
    logControllerError(req, 'teamController.removing_team_member');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { addTeamMember, getTeamMembers, updateTeamMember, removeMember };
