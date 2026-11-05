require('dotenv').config();

const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const Sentry = require('@sentry/node');
const redis = require('./lib/redis');
const { generalLimiter, writeLimiter, aiLimiter } = require('./middleware/rateLimiters');

const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/team');
const subtaskRoutes = require('./routes/subtasks');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const accountRoutes = require('./routes/account');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const createIpLimiter = ({ limit, windowMs, message, skip }) => rateLimit({
  limit,
  windowMs,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  handler(_req, res) {
    res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
    res.status(429).json({ error: message });
  },
});

const generalIpLimiter = createIpLimiter({
  limit: 300,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests. Please try again later.',
});
const writeIpLimiter = createIpLimiter({
  limit: 90,
  windowMs: 15 * 60 * 1000,
  message: 'Too many changes. Please wait a moment and try again.',
  skip: (req) => !['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method),
});

const scrubText = (value) => typeof value === 'string'
  ? value.replace(/Bearer\s+\S+/gi, '[redacted-token]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
  : value;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.url) {
          try {
            const parsed = new URL(event.request.url);
            event.request.url = `${parsed.origin}${parsed.pathname}`;
          } catch {
            delete event.request.url;
          }
        }
      }
      delete event.user;
      if (event.message) event.message = scrubText(event.message);
      for (const exception of event.exception?.values || []) {
        exception.value = scrubText(exception.value);
        for (const frame of exception.stacktrace?.frames || []) delete frame.vars;
      }
      event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
        ...breadcrumb,
        message: scrubText(breadcrumb.message),
        data: undefined,
      }));
      if (event.tags) {
        event.tags = Object.fromEntries(Object.entries(event.tags).map(([key, value]) => [key, scrubText(value)]));
      }
      delete event.extra;
      return event;
    },
  });
}

const allowedOrigins = [
  'https://nova-eta-swart.vercel.app',
  'https://nova-pearl-beta.vercel.app',
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean),
];

if (!redis.isRedisConfigured()) redis.warnUnavailable('redis_not_configured', 'not_configured', 0);

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  req.requestId = randomUUID();
  req.requestStartedAt = Date.now();
  req.requestPath = req.originalUrl.split('?')[0];
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    process.stdout.write(`${JSON.stringify({
      level: 'info',
      event: 'http_request',
      request_id: req.requestId,
      method: req.method,
      path: req.requestPath,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
    })}\n`);
  });
  next();
});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  exposedHeaders: [
    'X-Request-Id',
    'X-Total-Count',
    'X-Cache',
    'Retry-After',
    'RateLimit',
    'RateLimit-Policy',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
  ],
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', generalIpLimiter, writeIpLimiter);

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/account', accountRoutes);

app.get('/', (req, res) => {
  res.send('NOVA backend is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', async (req, res) => {
  try {
    const { error } = await require('./config/supabaseClient')
      .from('projects')
      .select('id')
      .limit(1);
    if (error) throw error;
    return res.json({ status: 'ok' });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
});

if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  process.stderr.write(`${JSON.stringify({
    level: 'error',
    event: 'http_error',
    request_id: req.requestId || null,
    method: req.method,
    path: req.requestPath || req.path,
    status,
    error_name: typeof error.name === 'string' ? error.name : 'Error',
    duration_ms: req.requestStartedAt ? Date.now() - req.requestStartedAt : null,
  })}\n`);
  if (status >= 500 && process.env.SENTRY_DSN) Sentry.captureException(error);
  if (res.headersSent) return next(error);
  return res.status(status).json({
    error: status === 413 ? 'Request body is too large' : status >= 500 ? 'Something went wrong' : 'Invalid request',
  });
});

module.exports = app;
