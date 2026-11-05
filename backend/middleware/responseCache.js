const { createHash } = require('crypto');
const redis = require('../lib/redis');

const CACHE_MAX_BYTES = 256 * 1024;
const cacheEnabled = (redisClient) => (
  process.env.CACHE_ENABLED !== 'false' && redisClient.isRedisConfigured()
);

const createResponseCache = ({ name, ttlSeconds, redisClient = redis }) => async (req, res, next) => {
  res.setHeader('X-Cache', 'MISS');
  if (
    !cacheEnabled(redisClient)
    || !req.user?.id
    || req.get('Cache-Control')?.toLowerCase().includes('no-cache')
  ) {
    return next();
  }

  const versionKey = `nova:cachever:${req.user.id}`;
  const versionResult = await redisClient.safeGet(versionKey);
  if (!versionResult.ok) return next();
  const parsedVersion = Number.parseInt(versionResult.value || '0', 10);
  const version = Number.isSafeInteger(parsedVersion) && parsedVersion >= 0 ? parsedVersion : 0;
  const queryHash = createHash('sha256')
    .update(JSON.stringify(req.validatedQuery || req.query))
    .digest('hex');
  const cacheKey = `nova:cache:${req.user.id}:${name}:v${version}:${queryHash}`;
  const cachedResult = await redisClient.safeGet(cacheKey);

  if (cachedResult.ok && cachedResult.value !== null) {
    try {
      const cached = typeof cachedResult.value === 'string'
        ? JSON.parse(cachedResult.value)
        : cachedResult.value;
      if (!cached || !Object.hasOwn(cached, 'body')) throw new Error('Invalid cache entry');
      if (cached.totalCount !== null) res.setHeader('X-Total-Count', cached.totalCount);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached.body);
    } catch {
      await redisClient.safeDel(cacheKey);
    }
  }

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      try {
        const serialized = JSON.stringify({
          body,
          totalCount: res.getHeader('X-Total-Count') ?? null,
        });
        if (typeof serialized === 'string' && Buffer.byteLength(serialized, 'utf8') <= CACHE_MAX_BYTES) {
          redisClient.safeSet(cacheKey, serialized, ttlSeconds)
            .catch(() => redisClient.warnUnavailable?.('redis_cache_failed'));
        }
      } catch {
        redisClient.warnUnavailable?.('redis_cache_failed');
      }
    }
    return sendJson(body);
  };
  return next();
};

module.exports = { createResponseCache };
