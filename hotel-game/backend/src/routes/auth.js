const { Router } = require('express');
const authService = require('../services/authService');
const authMiddleware = require('../middleware/auth');

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me (protected)
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

module.exports = router;
