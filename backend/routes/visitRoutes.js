const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/helpers');
const v = require('../controllers/visitController');
const { submitForm, getForms, downloadForm } = require('../controllers/formController');

router.use(authMiddleware);

// ── Visit CRUD ───────────────────────────────────────────────────────────────
router.post('/start',        authorizeRoles('faculty'),          v.startVisit);
router.patch('/:id/end',     authorizeRoles('faculty'),          v.endVisit);
router.get('/my',                                                 v.getMyVisits);
router.get('/active',        authorizeRoles('warden', 'admin'),  v.getActiveVisits);
router.get('/hostel',        authorizeRoles('warden'),           v.getHostelVisits);
router.get('/',              authorizeRoles('admin'),            v.getAllVisits);
router.get('/:id',                                               v.getVisitById);
router.patch('/:id/verify',  authorizeRoles('warden'),           v.verifyVisit);

// ── Form Routes ──────────────────────────────────────────────────────────────
router.post('/:id/forms',                   authorizeRoles('faculty'),              submitForm);
router.get('/:id/forms',                                                            getForms);
router.get('/:id/forms/:formType/download',                                         downloadForm);

module.exports = router;
