const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createProject,
  getProjects,
  getProject,
  deleteProject
} = require('../controllers/projectController');

router.post('/', authMiddleware, createProject);
router.get('/', authMiddleware, getProjects);
router.get('/:id', authMiddleware, getProject);
router.delete('/:id', authMiddleware, deleteProject);

module.exports = router;