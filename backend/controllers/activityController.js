const supabase = require('../config/supabaseClient');
const { logControllerError } = require('../utils/logger');
const { authorizeProject } = require('../utils/access');

const getProjectActivity = async (req, res) => {
  const { projectId } = req.params;
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };

  try {
    const access = await authorizeProject(projectId, req.user.id, 'viewer');
    if (access.status !== 200) return res.status(404).json({ error: 'Project not found' });

    const { data: entries, error, count } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      logControllerError(req, 'activityController.fetching_project_activity');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const actorIds = [...new Set(entries.map((entry) => entry.actor_id).filter(Boolean))];
    const { data: profiles, error: profileError } = actorIds.length
      ? await supabase.from('profiles').select('id, email, display_name, avatar_color').in('id', actorIds)
      : { data: [], error: null };
    if (profileError) {
      logControllerError(req, 'activityController.fetching_activity_actors');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    res.setHeader('X-Total-Count', String(count ?? offset + entries.length));
    return res.status(200).json(entries.map((entry) => ({
      ...entry,
      actor: profileById.get(entry.actor_id) || null,
    })));
  } catch (error) {
    logControllerError(req, 'activityController.fetching_project_activity');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { getProjectActivity };
