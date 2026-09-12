'use strict';

/**
 * HVMS Schedule Import Routes
 * All routes require a valid JWT (authMiddleware).
 * Admin-only routes are additionally guarded by authorizeRoles('admin').
 * Role-based data filtering for /visits and /visits/by-hostel is enforced
 * server-side in the controller — not just in the UI.
 */

const express   = require('express');
const multer    = require('multer');
const router    = express.Router();

const { authMiddleware }  = require('../middleware/authMiddleware');
const { authorizeRoles }  = require('../middleware/helpers');
const c                   = require('../controllers/scheduleController');

// ── Multer: memory storage, xlsx only, 10 MB limit ─────────────────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const extOk = file.originalname.toLowerCase().endsWith('.xlsx') ||
                file.originalname.toLowerCase().endsWith('.xls');

  if (allowed.includes(file.mimetype) || extOk) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx / .xls) are accepted.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Multer error handler
function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError || err.message?.includes('Excel')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
}

// ── All routes require authentication ─────────────────────────────────────────
router.use(authMiddleware);

// ── Import pipeline (admin only) ────────────────────────────────────────────────
router.post(
  '/upload-preview',
  authorizeRoles('admin'),
  upload.single('schedule'),
  multerErrorHandler,
  c.uploadPreview
);

router.post('/confirm/:id',  authorizeRoles('admin'), c.confirmImport);
router.post('/reject/:id',   authorizeRoles('admin'), c.rejectUpload);

// ── Upload management (admin only) ────────────────────────────────────────────
router.get('/uploads',       authorizeRoles('admin'), c.listUploads);
router.get('/uploads/:id',   authorizeRoles('admin'), c.getUpload);
router.delete('/uploads/:id', authorizeRoles('admin'), c.deleteUpload);

// ── Scheduled visits ────────────────────────────────────────────────────────────────
// NOTE: /visits/my and /visits/by-hostel/:hostelId must come BEFORE /visits/:id
// to prevent ":id" from matching the literal string "my" or "by-hostel".
router.get('/visits/my',                          c.getMySchedule);      // faculty: own visits
router.get('/visits/by-hostel/:hostelId',         c.getScheduleByHostel); // all roles, server-filtered
router.get('/visits',      authorizeRoles('admin','warden','faculty'), c.listScheduledVisits);
router.get('/visits/:id',  authorizeRoles('admin'), c.getScheduledVisit);

// ── Faculty profiles (admin only) ────────────────────────────────────────────
router.get('/faculty-profiles',                            authorizeRoles('admin'), c.listFacultyProfiles);
router.get('/faculty-profiles/:id',                        authorizeRoles('admin'), c.getFacultyProfile);
router.put('/faculty-profiles/:id',                        authorizeRoles('admin'), c.updateFacultyProfile);
router.post('/faculty-profiles/:id/complete',              authorizeRoles('admin'), c.completeFacultyProfile);

module.exports = router;
