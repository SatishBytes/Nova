const supabase = require('../config/supabaseClient');

const addTeamMember = async (req, res) => {
  const { project_id, user_id, email } = req.body;

  if (!project_id || !email) {
    return res.status(400).json({ error: 'project_id and email are required' });
  }

  const { data, error } = await supabase
    .from('team_members')
    .insert([{ project_id, user_id, email }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data[0]);
};

const getTeamMembers = async (req, res) => {
  const { projectId } = req.params;

  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('project_id', projectId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
};

const removeMember = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ message: 'Member removed' });
};

module.exports = { addTeamMember, getTeamMembers, removeMember };