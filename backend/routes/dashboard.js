const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, writeLimiter } = require('../middleware/rateLimiters');
const { createResponseCache } = require('../middleware/responseCache');
const { getDashboardSummary } = require('../controllers/dashboardController');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');

const router = express.Router();

router.get(
  '/summary',
  authMiddleware,
  generalLimiter,
  writeLimiter,
  validateRequest(schemas.notificationRead),
  createResponseCache({ name: 'dashboard-summary', ttlSeconds: 30 }),
  getDashboardSummary,
);

module.exports = router;
