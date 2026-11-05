const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, strictActionLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');
const {
  addTeamMember,
  getTeamMembers,
  updateTeamMember,
  removeMember
} = require('../controllers/teamController');

router.post('/', authMiddleware, generalLimiter, writeLimiter, strictActionLimiter, validateRequest(schemas.teamCreate), addTeamMember);
router.get('/project/:projectId', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.teamProject), getTeamMembers);
router.patch('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.teamUpdate), updateTeamMember);
router.delete('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.notificationId), removeMember);

module.exports = router;