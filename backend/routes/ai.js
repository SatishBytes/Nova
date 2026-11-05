const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { aiLimiter, generalLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');
const { generateTasks } = require('../controllers/aiController');

const router = express.Router();

router.post('/generate-tasks', authMiddleware, generalLimiter, writeLimiter, aiLimiter, validateRequest(schemas.aiGenerate), generateTasks);

module.exports = router;
