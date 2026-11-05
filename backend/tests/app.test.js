import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  AI_ENABLED: process.env.AI_ENABLED,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  CACHE_ENABLED: process.env.CACHE_ENABLED,
};

process.env.SUPABASE_URL = 'https://nova-test.supabase.co';
process.env.SUPABASE_KEY = 'test-service-key';
process.env.AI_ENABLED = 'false';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.CACHE_ENABLED = 'false';

const supabase = require('../config/supabaseClient');
const app = require('../app');

let activeUser = 'owner';
const project = {
  id: 'project-1',
  owner_id: 'owner',
  name: 'Test project',
  description: '',
  archived_at: null,
};

const membershipFor = (userId) => {
  if (userId === 'member' || userId === 'viewer') {
    return { project_id: project.id, user_id: userId, role: userId, status: 'active' };
  }
  return null;
};

const createQuery = (table) => {
  const filters = [];
  let operation = 'select';

  const result = () => {
    if (table === 'projects') {
      if (filters.some(([key, value]) => key === 'id' && value !== project.id)) return null;
      if (filters.some(([key, value]) => key === 'archived_at' && value === null) && project.archived_at) return null;
      return project;
    }
    if (table === 'team_members') {
      const userFilter = filters.find(([key]) => key === 'user_id')?.[1];
      return membershipFor(userFilter || activeUser);
    }
    if (table === 'tasks') {
      const taskId = filters.find(([key]) => key === 'id')?.[1];
      return taskId === 'task-1' ? { id: taskId, project_id: project.id, title: 'Test task', status: 'todo' } : null;
    }
    return null;
  };

  const query = {
    select() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    is(key, value) { filters.push([key, value]); return this; },
    in() { return this; },
    ilike() { return this; },
    not() { return this; },
    order() { return this; },
    limit() { return this; },
    range() { return this; },
    insert() { operation = 'insert'; return this; },
    update() { operation = 'update'; return this; },
    delete() { operation = 'delete'; return this; },
    maybeSingle() { return Promise.resolve({ data: result(), error: null }); },
    single() { return Promise.resolve({ data: result(), error: null }); },
    then(resolve, reject) {
      const data = table === 'tasks' && filters.some(([key]) => key === 'project_id')
        ? []
        : table === 'team_members' && operation === 'select'
          ? []
          : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return query;
};

beforeAll(() => {
  supabase.auth.getUser = vi.fn(async (token) => {
    activeUser = token;
    return {
      data: { user: { id: token, email: `${token}@example.test`, aud: token === 'wrong-audience' ? 'admin' : 'authenticated' } },
      error: token === 'expired' ? new Error('expired') : null,
    };
  });
  supabase.from = vi.fn((table) => createQuery(table));
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  activeUser = 'owner';
});

const asUser = (userId) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${userId}`),
  post: (path) => request(app).post(path).set('Authorization', `Bearer ${userId}`),
  patch: (path) => request(app).patch(path).set('Authorization', `Bearer ${userId}`),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${userId}`),
});

describe('API security and validation', () => {
  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/projects');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it.each(['expired', 'wrong-audience'])('rejects invalid JWT claims for %s', async (token) => {
    const response = await asUser(token).get('/api/projects');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
  });

  it('rejects pagination beyond the endpoint maximum', async () => {
    const response = await asUser('owner').get('/api/projects?limit=101');
    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'query.limit' }),
    ]));
  });

  it('serves liveness and readiness checks without exposing database errors', async () => {
    const health = await request(app).get('/health');
    const readiness = await request(app).get('/health/ready');
    expect(health.body).toEqual({ status: 'ok' });
    expect(readiness.status).toBe(200);
    expect(readiness.body).toEqual({ status: 'ok' });
  });

  it.each([
    ['tasks', '/api/tasks/project/project-1'],
    ['comments', '/api/tasks/task-1/comments'],
    ['team', '/api/team/project/project-1'],
    ['activity', '/api/projects/project-1/activity'],
  ])('returns 404 to a non-member reading %s', async (_resource, path) => {
    const response = await asUser('outsider').get(path);
    expect(response.status).toBe(404);
  });

  it.each([
    ['create', () => asUser('viewer').post('/api/tasks').send({ project_id: project.id, title: 'New task' })],
    ['update', () => asUser('viewer').patch('/api/tasks/task-1').send({ title: 'Changed task' })],
    ['delete', () => asUser('viewer').delete('/api/tasks/task-1')],
    ['reorder', () => asUser('viewer').post('/api/tasks/reorder').send({
      project_id: project.id,
      moves: [{ id: 'task-1', status: 'done', position: 0 }],
    })],
  ])('blocks a viewer from task %s', async (_action, sendRequest) => {
    const response = await sendRequest();
    expect(response.status).toBe(403);
  });

  it('blocks members from team administration and project archiving', async () => {
    const invite = await asUser('member').post('/api/team').send({
      project_id: project.id,
      email: 'person@example.test',
      role: 'member',
    });
    const archive = await asUser('member').delete(`/api/projects/${project.id}`);
    expect(invite.status).toBe(403);
    expect(archive.status).toBe(403);
  });

  it('allows only owners to permanently delete archived projects', async () => {
    project.archived_at = new Date().toISOString();
    const ownerDelete = await asUser('owner').delete(`/api/projects/${project.id}/permanent`);
    const memberDelete = await asUser('member').delete(`/api/projects/${project.id}/permanent`);
    project.archived_at = null;

    expect(ownerDelete.status).toBe(200);
    expect(memberDelete.status).toBe(403);
  });

  it('allows an owner to read their project', async () => {
    const response = await asUser('owner').get(`/api/projects/${project.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: project.id, role: 'owner' });
  });

  it.each([
    [{ project_id: project.id, title: 'New task', status: 'blocked' }, 'status'],
    [{ project_id: project.id, title: 'New task', priority: 'critical' }, 'priority'],
    [{ project_id: project.id, title: 't'.repeat(101) }, 'title'],
  ])('rejects invalid task %s', async (body, _field) => {
    const response = await asUser('owner').post('/api/tasks').send(body);
    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it('returns 404 when AI task generation is disabled', async () => {
    const response = await asUser('owner')
      .post('/api/ai/generate-tasks')
      .send({ project_id: project.id, description: 'Plan a launch' });
    expect(response.status).toBe(404);
  });

  it('limits AI requests per authenticated user', async () => {
    const client = request(app);
    const ip = '203.0.113.201';
    const responses = [];
    for (let index = 0; index < 11; index += 1) {
      responses.push(await client
        .post('/api/ai/generate-tasks')
        .set('Authorization', 'Bearer owner')
        .set('X-Forwarded-For', ip)
        .send({ project_id: project.id, description: 'Plan a launch' }));
    }
    expect(responses.at(-1).status).toBe(429);
  });
});
