import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.CACHE_ENABLED = 'true';
process.env.REDIS_TIMEOUT_MS = '2000';

const state = {
  configured: true,
  failure: false,
  cache: new Map(),
};

const fakeRedis = {
  isRedisConfigured: () => state.configured,
  safeGet: async (key) => (state.failure
    ? { ok: false, value: null }
    : { ok: true, value: state.cache.get(key) ?? null }),
  safeSet: async (key, value) => {
    if (state.failure) return { ok: false, value: null };
    state.cache.set(key, value);
    return { ok: true, value: 'OK' };
  },
  safeDel: async (key) => {
    state.cache.delete(key);
    return { ok: true, value: 1 };
  },
  safeIncr: async (key) => {
    const next = Number(state.cache.get(key) || 0) + 1;
    state.cache.set(key, next);
    return { ok: true, value: next };
  },
};

const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { createResponseCache } = require('../middleware/responseCache');
const { createCacheInvalidator } = require('../utils/cacheInvalidation');
const { getTimeoutMs, runWithTimeout } = require('../lib/redis');

const createRateLimitApp = (limiter) => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: req.get('x-user-id') || 'user-a' };
    next();
  });
  app.get('/', limiter, (_req, res) => res.json({ status: 'ok' }));
  return app;
};

const createCachedApp = () => {
  let responseNumber = 0;
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: req.get('x-user-id') || 'user-a' };
    next();
  });
  app.get('/', createResponseCache({ name: 'projects', ttlSeconds: 15, redisClient: fakeRedis }), (req, res) => {
    responseNumber += 1;
    return res.json({ user_id: req.user.id, response_number: responseNumber });
  });
  return app;
};

beforeEach(() => {
  state.configured = true;
  state.failure = false;
  state.cache.clear();
});

describe('Redis rate limiting and response caching', () => {
  it('allows Redis operations slower than 400 ms when they finish before the configured timeout', async () => {
    expect(getTimeoutMs()).toBe(2000);
    const result = await runWithTimeout(
      () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 450)),
    );

    expect(result).toEqual({ ok: true, value: 'PONG' });
  });

  it('fails open when a Redis operation exceeds the configured timeout', async () => {
    const logSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const result = await runWithTimeout(
        () => new Promise((resolve) => setTimeout(() => resolve('late'), 2100)),
      );
      expect(result).toEqual({ ok: false, value: null });
      const logged = logSpy.mock.calls.map(([entry]) => String(entry)).join('');
      expect(logged).toContain('"reason_category":"timeout"');
      expect(logged).toContain('"duration_ms":');
      expect(logged).not.toContain('UPSTASH_REDIS_REST_URL');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('returns 429 at the in-memory limit when Redis is not configured', async () => {
    state.configured = false;
    const limiter = createRateLimiter({
      name: 'test-memory',
      limit: 1,
      windowMs: 60_000,
      message: 'Too many requests',
    });
    const app = createRateLimitApp(limiter);

    expect((await request(app).get('/')).status).toBe(200);
    const limited = await request(app).get('/');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Too many requests' });
    expect(limited.headers['retry-after']).toBeTruthy();
    expect(limited.headers['ratelimit-policy']).toBeTruthy();
  });

  it('falls back to the in-memory limiter when Redis throws', async () => {
    const distributedLimiter = { limit: vi.fn().mockRejectedValue(new Error('private redis failure')) };
    const limiter = createRateLimiter({
      name: 'test-fallback',
      limit: 1,
      windowMs: 60_000,
      message: 'Too many requests',
      distributedLimiter,
    });
    const app = createRateLimitApp(limiter);
    const logSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      expect((await request(app).get('/')).status).toBe(200);
      const limited = await request(app).get('/');
      expect(limited.status).toBe(429);
      expect(JSON.stringify(limited.body)).not.toContain('private redis failure');
      expect(logSpy.mock.calls.map(([entry]) => String(entry)).join('')).not.toContain('private redis failure');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('returns 429 with standard headers when the shared limit is exceeded', async () => {
    const distributedLimiter = {
      limit: vi.fn()
        .mockResolvedValueOnce({ success: true, limit: 1, remaining: 0, reset: Date.now() + 10_000 })
        .mockResolvedValue({ success: false, limit: 1, remaining: 0, reset: Date.now() + 10_000 }),
    };
    const limiter = createRateLimiter({
      name: 'test-distributed',
      limit: 1,
      windowMs: 60_000,
      message: 'Too many requests',
      distributedLimiter,
    });
    const app = createRateLimitApp(limiter);

    expect((await request(app).get('/')).status).toBe(200);
    const limited = await request(app).get('/');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Too many requests' });
    expect(limited.headers['retry-after']).toBeTruthy();
    expect(limited.headers.ratelimit).toContain('remaining=0');
  });

  it('serves a cache miss followed by a hit for the same user', async () => {
    const app = createCachedApp();
    const first = await request(app).get('/');
    const second = await request(app).get('/');

    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
  });

  it('does not share cached responses between users', async () => {
    const app = createCachedApp();
    const userA = await request(app).get('/').set('X-User-Id', 'user-a');
    const userB = await request(app).get('/').set('X-User-Id', 'user-b');
    const userBAgain = await request(app).get('/').set('X-User-Id', 'user-b');

    expect(userA.body.user_id).toBe('user-a');
    expect(userB.headers['x-cache']).toBe('MISS');
    expect(userB.body.user_id).toBe('user-b');
    expect(userBAgain.headers['x-cache']).toBe('HIT');
    expect(userBAgain.body.user_id).toBe('user-b');
  });

  it('keeps serving responses when Redis cache reads fail and does not expose errors', async () => {
    state.failure = true;
    const response = await request(createCachedApp()).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['x-cache']).toBe('MISS');
    expect(JSON.stringify(response.body)).not.toContain('private redis failure');
  });

  it('bypasses the cache when the request asks for no-cache', async () => {
    const app = createCachedApp();
    const first = await request(app).get('/');
    const bypassed = await request(app).get('/').set('Cache-Control', 'no-cache');
    const afterBypass = await request(app).get('/');

    expect(first.headers['x-cache']).toBe('MISS');
    expect(bypassed.headers['x-cache']).toBe('MISS');
    expect(afterBypass.headers['x-cache']).toBe('HIT');
  });

  it('invalidates cached project data for the owner and active members', async () => {
    const fakeSupabase = {
      from(table) {
        const filters = [];
        return {
          select() { return this; },
          eq(key, value) { filters.push([key, value]); return this; },
          maybeSingle: async () => ({
            data: table === 'projects' && filters.some(([key, value]) => key === 'id' && value === 'project-1')
              ? { owner_id: 'owner-a' }
              : null,
            error: null,
          }),
          then(resolve, reject) {
            const data = table === 'team_members' && filters.some(([key, value]) => key === 'project_id' && value === 'project-1')
              ? [{ user_id: 'member-b' }]
              : [];
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };
      },
    };
    const invalidator = createCacheInvalidator({ supabase: fakeSupabase, redis: fakeRedis });
    await invalidator.invalidateForProject('project-1');

    expect(state.cache.get('nova:cachever:owner-a')).toBe(1);
    expect(state.cache.get('nova:cachever:member-b')).toBe(1);
  });
});
