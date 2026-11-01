const supabase = require('../config/supabaseClient');
const { userOwnsProject } = require('../utils/ownership');

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
      console.error('Error creating project:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', req.user.id);

    if (error) {
      console.error('Error fetching projects:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getProject = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('owner_id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching project:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const deleteProject = async (req, res) => {
  const { id } = req.params;

  try {
    if (!(await userOwnsProject(id, req.user.id))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('project_id', id);

    if (tasksError) {
      console.error('Error deleting project tasks:', tasksError);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { error: membersError } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', id);

    if (membersError) {
      console.error('Error deleting project team members:', membersError);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('owner_id', req.user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error deleting project:', error);
      return res.status(500).json({ error: 'Something went wrong' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { createProject, getProjects, getProject, deleteProject };