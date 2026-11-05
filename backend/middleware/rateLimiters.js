const { createRateLimiter } = require('./rateLimiter');

/*
Redis command budget per request: 1 rate-limit command; cached reads add 2
commands on hits or 3 on misses. Fixed windows and disabled analytics avoid
extra background writes.
*/
const generalLimiter = createRateLimiter({
  name: 'general',
  limit: 300,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests. Please try again later.',
});

const writeLimiter = createRateLimiter({
  name: 'writes',
  limit: 90,
  windowMs: 15 * 60 * 1000,
  message: 'Too many changes. Please wait a moment and try again.',
  skip: (req) => !['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method),
});

const strictActionLimiter = createRateLimiter({
  name: 'strict-actions',
  limit: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests. Please try again later.',
});

const aiLimiter = createRateLimiter({
  name: 'ai',
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Task generation limit reached. Please try again later.',
});

module.exports = { aiLimiter, generalLimiter, strictActionLimiter, writeLimiter };
