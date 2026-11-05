const { Redis } = require('@upstash/redis');

const DEFAULT_TIMEOUT_MS = 2000;
let client;
let missingWarningLogged = false;
let lastFailureWarningAt = 0;

const getTimeoutMs = () => {
  const configuredTimeout = Number.parseInt(process.env.REDIS_TIMEOUT_MS || '', 10);
  return Number.isInteger(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS;
};

const isRedisConfigured = () => Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

const classifyRedisError = (error) => {
  const status = error?.status || error?.statusCode || error?.response?.status;
  const code = error?.code || error?.cause?.code;
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  if (
    code === 'REDIS_TIMEOUT'
    || code === 'ETIMEDOUT'
    || code === 'ABORT_ERR'
    || error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
    || message.includes('timeout')
    || message.includes('timed out')
  ) return 'timeout';
  if (status === 401 || status === 403 || /unauthorized|authentication|invalid token/.test(message)) {
    return 'auth_error';
  }
  if (
    typeof code === 'string' && /^(ECONN|EHOST|ENET|EAI_|ERR_NETWORK)/.test(code)
    || /network|fetch failed|connection refused|socket hang up/.test(message)
  ) return 'network_error';
  return 'unexpected_response';
};

const warnUnavailable = (event, reasonCategory = 'unexpected_response', durationMs = 0) => {
  const now = Date.now();
  if (event === 'redis_not_configured') {
    if (missingWarningLogged) return;
    missingWarningLogged = true;
  } else {
    if (now - lastFailureWarningAt < 60_000) return;
    lastFailureWarningAt = now;
  }
  process.stderr.write(`${JSON.stringify({
    level: 'warn',
    event,
    reason_category: reasonCategory,
    duration_ms: Math.max(0, Math.round(durationMs)),
    message: 'Redis is unavailable; using in-memory rate limiting and skipping cache',
  })}\n`);
};

const getRedisClient = () => {
  if (!isRedisConfigured()) {
    warnUnavailable('redis_not_configured');
    return null;
  }
  if (!client) {
    try {
      client = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        retry: { retries: 0 },
        signal: () => AbortSignal.timeout(getTimeoutMs()),
      });
    } catch (error) {
      warnUnavailable('redis_unavailable', classifyRedisError(error), 0);
      return null;
    }
  }
  return client;
};

const runWithTimeout = async (operation, event = 'redis_operation_failed') => {
  const timeoutMs = getTimeoutMs();
  const startedAt = Date.now();
  let timer;
  try {
    const result = await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Redis operation timed out');
          error.code = 'REDIS_TIMEOUT';
          reject(error);
        }, timeoutMs);
        timer.unref?.();
      }),
    ]);
    return { ok: true, value: result };
  } catch (error) {
    warnUnavailable(event, classifyRedisError(error), Date.now() - startedAt);
    return { ok: false, value: null };
  } finally {
    clearTimeout(timer);
  }
};

const run = (event, operation) => {
  const redis = getRedisClient();
  if (!redis) return Promise.resolve({ ok: false, value: null });
  return runWithTimeout(() => operation(redis), event);
};

const safeGet = (key) => run('redis_operation_failed', (redis) => redis.get(key));
const safeMGet = (...keys) => run('redis_operation_failed', (redis) => redis.mget(...keys));
const safeSet = (key, value, ttlSeconds) => run(
  'redis_operation_failed',
  (redis) => redis.set(key, value, { ex: ttlSeconds }),
);
const safeDel = (key) => run('redis_operation_failed', (redis) => redis.del(key));
const safeIncr = (key) => run('redis_operation_failed', (redis) => redis.incr(key));

module.exports = {
  getTimeoutMs,
  getRedisClient,
  isRedisConfigured,
  classifyRedisError,
  runWithTimeout,
  safeDel,
  safeGet,
  safeIncr,
  safeMGet,
  safeSet,
  warnUnavailable,
};

Object.defineProperty(module.exports, 'TIMEOUT_MS', {
  enumerable: true,
  get: getTimeoutMs,
});
