const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/helpers');
const c = require('../controllers/hostelController');

router.use(authMiddleware);

router.get('/',                                           c.getAll);
router.get('/:id',                                        c.getById);
router.post('/',           authorizeRoles('admin'),       c.create);
router.put('/:id',         authorizeRoles('admin'),       c.update);
router.patch('/:id/assign-warden', authorizeRoles('admin'), c.assignWarden);
router.delete('/:id',      authorizeRoles('admin'),       c.remove);

module.exports = router;
