// ─── authRoutes.js ────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const c = require('../controllers/authController');

router.post('/login', c.login);
router.post('/logout', authMiddleware, c.logout);
router.get('/me', authMiddleware, c.getMe);
router.put('/profile', authMiddleware, c.updateProfile);
router.put('/change-password', authMiddleware, c.changePassword);

module.exports = router;
