const supabase = require('../config/supabaseClient');
const { logControllerError } = require('../utils/logger');
const { getTaskProjectId } = require('../utils/ownership');
const { authorizeProject } = require('../utils/access');
const { createNotification, recordActivity } = require('../utils/collaboration');
const { invalidateForProject } = require('../utils/cacheInvalidation');

const getTaskComments = async (req, res) => {
  const { id: taskId } = req.params;
  const { limit, offset } = req.validatedQuery || { limit: 50, offset: 0 };

  try {
    const projectId = await getTaskProjectId(taskId);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    const access = await authorizeProject(projectId, req.user.id, 'viewer');
    if (access.status !== 200) return res.status(404).json({ error: 'Task not found' });

    const { data: comments, error, count } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) {
      logControllerError(req, 'commentController.fetching_task_comments');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const authorIds = [...new Set(comments.map((comment) => comment.author_id))];
    if (!authorIds.length) return res.status(200).json([]);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_color')
      .in('id', authorIds);
    if (profileError) {
      logControllerError(req, 'commentController.fetching_comment_authors');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    res.setHeader('X-Total-Count', String(count ?? offset + comments.length));
    return res.status(200).json(comments.map((comment) => ({
      ...comment,
      author: profileById.get(comment.author_id) || null,
    })));
  } catch (error) {
    logControllerError(req, 'commentController.fetching_task_comments');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const createTaskComment = async (req, res) => {
  const { id: taskId } = req.params;
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 2000) {
    return res.status(400).json({ error: 'Comment is required and must be 2000 characters or fewer' });
  }

  try {
    const projectId = await getTaskProjectId(taskId);
    if (!projectId) return res.status(404).json({ error: 'Task not found' });
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.status === 404 ? 'Task not found' : 'You do not have permission to comment' });
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('id', taskId)
      .maybeSingle();
    if (taskError) {
      logControllerError(req, 'commentController.finding_task_for_comment');
      return res.status(500).json({ error: 'Something went wrong' });
    }
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { data: comment, error } = await supabase
      .from('comments')
      .insert([{ task_id: taskId, author_id: req.user.id, body }])
      .select()
      .single();
    if (error) {
      logControllerError(req, 'commentController.creating_task_comment');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const { data: author, error: authorError } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_color')
      .eq('id', req.user.id)
      .maybeSingle();
    if (authorError) {
      logControllerError(req, 'commentController.fetching_comment_author', 201);
    }

    await recordActivity({
      projectId,
      actorId: req.user.id,
      action: 'commented',
      entityType: 'task',
      entityId: taskId,
      meta: { task_title: task.title },
    });

    const mentionedEmails = [...new Set(
      [...body.matchAll(/@([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi)]
        .map((match) => match[1].toLowerCase()),
    )];
    if (mentionedEmails.length) {
      const { data: members, error: memberError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('status', 'active');
      if (memberError) {
        logControllerError(req, 'commentController.finding_mentioned_project_members', 201);
      } else {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('owner_id')
          .eq('id', projectId)
          .maybeSingle();
        if (projectError) {
          logControllerError(req, 'commentController.finding_project_owner_for_mentions', 201);
        } else {
          const memberIds = [...new Set([project?.owner_id, ...members.map((member) => member.user_id)].filter(Boolean))];
          const { data: profiles, error: profileError } = memberIds.length
            ? await supabase.from('profiles').select('id, email').in('id', memberIds)
            : { data: [], error: null };
          if (profileError) {
            logControllerError(req, 'commentController.resolving_comment_mentions', 201);
          } else {
            for (const profile of profiles) {
              if (profile.id !== req.user.id && mentionedEmails.includes(profile.email?.toLowerCase())) {
                await createNotification({
                  userId: profile.id,
                  type: 'mention',
                  title: `${author?.display_name || 'A teammate'} mentioned you`,
                  body: `In a comment on "${task.title}".`,
                  link: `/project/${projectId}?task=${taskId}`,
                  entityId: comment.id,
                });
              }
            }
          }
        }
      }
    }

    await invalidateForProject(projectId);
    return res.status(201).json({ ...comment, author: author || null });
  } catch (error) {
    logControllerError(req, 'commentController.creating_task_comment');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { getTaskComments, createTaskComment };
