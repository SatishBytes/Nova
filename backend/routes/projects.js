const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas } = require('../validation/schemas');
const { createResponseCache } = require('../middleware/responseCache');
const { getProjectActivity } = require('../controllers/activityController');
const {
  createProject,
  getProjects,
  getArchivedProjects,
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProjectPermanently,
} = require('../controllers/projectController');

const projectListCache = createResponseCache({ name: 'projects', ttlSeconds: 15 });

router.post('/', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.projectCreate), createProject);
router.get('/', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.projectList), projectListCache, getProjects);
router.get('/archived', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.archivedProjectList), getArchivedProjects);
router.get('/:projectId/activity', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.projectActivity), getProjectActivity);
router.delete('/:id/permanent', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.archivedProjectId), deleteProjectPermanently);
router.post('/:id/restore', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.archivedProjectId), restoreProject);
router.get('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.projectId), getProject);
router.patch('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.projectUpdate), updateProject);
router.delete('/:id', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.projectId), archiveProject);

module.exports = router;