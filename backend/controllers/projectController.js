const supabase = require('../config/supabaseClient');

const createProject = async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([{ name, description, owner_id: userId }])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data[0]);
};

const getProjects = async (req, res) => {
  const userId = req.user.id;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
};

module.exports = { createProject, getProjects };