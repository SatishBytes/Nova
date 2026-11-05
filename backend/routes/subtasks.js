const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');
const { updateSubtask, deleteSubtask } = require('../controllers/subtaskController');

router.patch('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.subtaskUpdate), updateSubtask);
router.delete('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.taskId), deleteSubtask);

module.exports = router;
