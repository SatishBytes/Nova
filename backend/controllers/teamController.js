const supabase = require('../config/supabaseClient');
const { userOwnsProject } = require('../utils/ownership');

const addTeamMember = async (req, res) => {
  const { project_id, user_id, email } = req.body || {};

  if (!project_id || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'project_id and email are required' });
  }

  try {
    if (!(await userOwnsProject(project_id, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert([{ project_id, user_id, email: email.trim() }])
      .select();

    if (error) {
      console.error('Error adding team member:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error adding team member:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getTeamMembers = async (req, res) => {
  const { projectId } = req.params;

  try {
    if (!(await userOwnsProject(projectId, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching team members:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching team members:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const removeMember = async (req, res) => {
  const { id } = req.params;

  try {
    const { data: member, error: lookupError } = await supabase
      .from('team_members')
      .select('id, project_id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      console.error('Error finding team member:', lookupError);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (!(await userOwnsProject(member.project_id, req.user.id))) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    const { data, error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('project_id', member.project_id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error removing team member:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    return res.status(200).json({ message: 'Member removed' });
  } catch (error) {
    console.error('Error removing team member:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { addTeamMember, getTeamMembers, removeMember };