const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createTask,
  getTasksByProject,
  updateTaskStatus,
  deleteTask
} = require('../controllers/taskController');

router.post('/', authMiddleware, createTask);
router.get('/project/:projectId', authMiddleware, getTasksByProject);
router.patch('/:id', authMiddleware, updateTaskStatus);
router.delete('/:id', authMiddleware, deleteTask);

module.exports = router;