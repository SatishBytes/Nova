const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, strictActionLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');
const {
  createTask,
  getTasksByProject,
  updateTask,
  reorderTasks,
  deleteTask
} = require('../controllers/taskController');
const {
  createSubtask,
  updateSubtask,
  deleteSubtask
} = require('../controllers/subtaskController');
const { getTaskComments, createTaskComment } = require('../controllers/commentController');

router.post('/reorder', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.taskReorder), reorderTasks);
router.post('/', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.taskCreate), createTask);
router.get('/project/:projectId', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.taskProject), getTasksByProject);
router.post('/:id/subtasks', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.subtaskCreate), createSubtask);
router.get('/:id/comments', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.commentRead), getTaskComments);
router.post('/:id/comments', authMiddleware, generalLimiter, writeLimiter, strictActionLimiter, validateRequest(schemas.commentCreate), createTaskComment);
router.patch('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.taskUpdate), updateTask);
router.delete('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.taskId), deleteTask);

module.exports = router;