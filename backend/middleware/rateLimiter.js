const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const redis = require('../lib/redis');

const distributedLimiters = new Map();
const identityFor = (req) => (req.user?.id
  ? `user:${req.user.id}`
  : `ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`);

const createFallbackLimiter = ({ limit, windowMs, message, skip }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id
    ? `user:${req.user.id}`
    : `ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`),
  skip,
  handler(_req, res) {
    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
    res.status(429).json({ error: message });
  },
});

const createRateLimiter = ({ name, limit, windowMs, message, skip, distributedLimiter }) => {
  const fallbackLimiter = createFallbackLimiter({ limit, windowMs, message, skip });
  const getDistributedLimiter = () => {
    if (distributedLimiter) return distributedLimiter;
    if (!redis.isRedisConfigured()) return null;
    if (!distributedLimiters.has(name)) {
      const client = redis.getRedisClient();
      if (!client) return null;
      const { Ratelimit } = require('@upstash/ratelimit');
      const seconds = Math.max(1, Math.ceil(windowMs / 1000));
      distributedLimiters.set(name, new Ratelimit({
        redis: client,
        limiter: Ratelimit.fixedWindow(limit, `${seconds} s`),
        prefix: `nova:rl:${name}`,
        analytics: false,
        ephemeralCache: new Map(),
        timeout: redis.getTimeoutMs(),
      }));
    }
    return distributedLimiters.get(name);
  };

  return async (req, res, next) => {
    if (skip?.(req, res)) return next();
    let distributedLimiter;
    try {
      distributedLimiter = getDistributedLimiter();
    } catch {
      redis.warnUnavailable('redis_rate_limit_failed');
      return fallbackLimiter(req, res, next);
    }
    if (!distributedLimiter) return fallbackLimiter(req, res, next);

    const startedAt = Date.now();
    try {
      const result = await distributedLimiter.limit(identityFor(req));
      if (result.reason === 'timeout') {
        redis.warnUnavailable('redis_rate_limit_failed', 'timeout', Date.now() - startedAt);
        return fallbackLimiter(req, res, next);
      }

      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      const windowSeconds = Math.ceil(windowMs / 1000);
      res.setHeader('RateLimit', `limit=${result.limit}, remaining=${result.remaining}, reset=${retryAfter}`);
      res.setHeader('RateLimit-Policy', `${result.limit};w=${windowSeconds}`);
      res.setHeader('RateLimit-Limit', String(result.limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      res.setHeader('RateLimit-Reset', String(retryAfter));
      if (!result.success) {
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ error: message });
      }
      return next();
    } catch (error) {
      redis.warnUnavailable(
        'redis_rate_limit_failed',
        redis.classifyRedisError(error),
        Date.now() - startedAt,
      );
      return fallbackLimiter(req, res, next);
    }
  };
};

module.exports = { createRateLimiter };
