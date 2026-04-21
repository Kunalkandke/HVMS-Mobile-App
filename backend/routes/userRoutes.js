const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/helpers');
const c = require('../controllers/userController');

router.use(authMiddleware);
router.use(authorizeRoles('admin'));

router.get('/',                  c.getAllUsers);
router.get('/:id',               c.getUserById);
router.post('/',                 c.createUser);
router.put('/:id',               c.updateUser);
router.patch('/:id/status',      c.toggleUserStatus);
router.patch('/:id/role',        c.changeUserRole);
router.post('/:id/reset-password', c.resetPassword);

module.exports = router;
