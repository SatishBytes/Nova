const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, writeLimiter } = require('../middleware/rateLimiters');
const validateRequest = require('../middleware/validateRequest');
const { schemas, pagination } = require('../validation/schemas');
const { deleteAccount, exportUserData } = require('../controllers/accountController');

const router = express.Router();

router.get('/export', authMiddleware, generalLimiter, writeLimiter, (req, res, next) => {
  const result = pagination.safeParse(req.query);
  if (!result.success) return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
  req.validatedQuery = result.data;
  return next();
}, exportUserData);
router.delete('/', authMiddleware, generalLimiter, writeLimiter, validateRequest(schemas.accountDelete), deleteAccount);

module.exports = router;
