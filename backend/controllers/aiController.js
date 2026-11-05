const { authorizeProject } = require('../utils/access');
const { logControllerError } = require('../utils/logger');

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestsByUser = new Map();

const parseSuggestions = (text) => {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed.tasks)) return [];
  return parsed.tasks
    .filter((task) => typeof task === 'string')
    .map((task) => task.trim())
    .filter((task) => task.length > 0 && task.length <= 100)
    .slice(0, 12);
};

const generateTasks = async (req, res) => {
  if (process.env.AI_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Task generation is unavailable' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    logControllerError(req, 'aiController.ai_task_generation_is_enabled_but_anthropic_api_key_is_not_configured');
    return res.status(500).json({ error: 'Something went wrong' });
  }

  const body = req.body || {};
  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(projectId) || !description || description.length > 2000) {
    return res.status(400).json({ error: 'A valid project_id and a description of 2000 characters or fewer are required' });
  }

  try {
    const access = await authorizeProject(projectId, req.user.id, 'member');
    if (access.status !== 200) {
      return res.status(access.status).json({
        error: access.status === 404 ? 'Project not found' : 'You do not have permission to generate project tasks',
      });
    }

    const now = Date.now();
    const recentRequests = (requestsByUser.get(req.user.id) || [])
      .filter((timestamp) => now - timestamp < WINDOW_MS);
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
      requestsByUser.set(req.user.id, recentRequests);
      return res.status(429).json({ error: 'Task generation limit reached. Try again later.' });
    }
    recentRequests.push(now);
    requestsByUser.set(req.user.id, recentRequests);

    if (typeof fetch !== 'function') {
      logControllerError(req, 'aiController.ai_task_generation_requires_a_runtime_with_global_fetch_support');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Suggest 4 to 8 concrete, concise project task titles based on this description. Return only valid JSON with this shape: {"tasks":["Task title"]}. Every title must be 100 characters or fewer.\n\nProject description:\n${description}`,
        }],
      }),
    });

    if (!response.ok) {
      logControllerError(req, 'aiController.ai_task_generation_provider_returned_an_error');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    const result = await response.json();
    const text = result.content
      ?.filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n') || '';
    const tasks = parseSuggestions(text);
    if (!tasks.length) {
      logControllerError(req, 'aiController.ai_task_generation_provider_returned_no_valid_task_suggestions');
      return res.status(500).json({ error: 'Something went wrong' });
    }

    return res.status(200).json({ tasks });
  } catch (error) {
    logControllerError(req, 'aiController.generating_task_suggestions');
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

module.exports = { generateTasks };
