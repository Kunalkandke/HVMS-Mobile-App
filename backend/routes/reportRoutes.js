const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/helpers');
const c = require('../controllers/reportController');

router.use(authMiddleware);

router.get('/dashboard',   c.getDashboardStats);
router.get('/daily',       authorizeRoles('admin'),            c.getDaily);
router.get('/monthly',     authorizeRoles('admin'),            c.getMonthly);
router.get('/by-hostel',   authorizeRoles('admin', 'warden'),  c.getByHostel);
router.get('/by-faculty',  authorizeRoles('admin'),            c.getByFaculty);

module.exports = router;
