const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  addTeamMember,
  getTeamMembers,
  removeMember
} = require('../controllers/teamController');

router.post('/', authMiddleware, addTeamMember);
router.get('/project/:projectId', authMiddleware, getTeamMembers);
router.delete('/:id', authMiddleware, removeMember);

module.exports = router;