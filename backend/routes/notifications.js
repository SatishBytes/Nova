const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

router.get('/', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.notificationRead), getNotifications);
router.patch('/read-all', authMiddleware, generalLimiter, writeLimiter, markAllNotificationsRead);
router.patch('/:id/read', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.notificationId), markNotificationRead);

module.exports = router;
