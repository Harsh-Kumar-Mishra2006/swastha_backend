// routes/mltReportRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

const {
  getMLTDashboard,
  getAssignedTests,
  acceptTestAssignment,
  rejectTestAssignment,
  startTest,
  createDetailedReport,
  submitTestResults,
  getTestReportDetails,
  getCompletedReports,
  getReportHistory,
  getMLTStatistics
} = require('../controllers/MLTReportController');

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'test_reports',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx'],
    transformation: [{ width: 2000, height: 2000, crop: 'limit' }]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDF, and Word documents are allowed'), false);
    }
  }
});

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================

// ✅ Apply authentication to all routes
router.use(authenticateToken);

// ============================================
// MLT DASHBOARD & OVERVIEW
// ============================================

/**
 * 📊 MLT Dashboard
 * GET /api/mlt-reports/dashboard/:mltId
 */
router.get(
  '/dashboard/:mltId',
  requireRole(['MLT']),
  getMLTDashboard
);

/**
 * 📊 MLT Statistics
 * GET /api/mlt-reports/:mltId/statistics
 */
router.get(
  '/:mltId/statistics',
  requireRole(['MLT']),
  getMLTStatistics
);

// ============================================
// ASSIGNED TESTS
// ============================================

/**
 * 📋 Get Assigned Tests
 * GET /api/mlt-reports/assigned/:mltId
 */
router.get(
  '/assigned/:mltId',
  requireRole(['MLT']),
  getAssignedTests
);

/**
 * ✅ Accept Test Assignment
 * PUT /api/mlt-reports/:testId/accept
 */
router.put(
  '/:testId/accept',
  requireRole(['MLT']),
  acceptTestAssignment
);

/**
 * ❌ Reject Test Assignment
 * PUT /api/mlt-reports/:testId/reject
 */
router.put(
  '/:testId/reject',
  requireRole(['MLT']),
  rejectTestAssignment
);

/**
 * ▶️ Start Test
 * PUT /api/mlt-reports/:testId/start
 */
router.put(
  '/:testId/start',
  requireRole(['MLT']),
  startTest
);

// ============================================
// REPORT CREATION & SUBMISSION
// ============================================

/**
 * 📝 Create Detailed Report
 * PUT /api/mlt-reports/:testId/report
 */
router.put(
  '/:testId/report',
  requireRole(['MLT']),
  upload.single('test_report_file'),
  createDetailedReport
);

/**
 * 📎 Submit Test Results (Simple)
 * PUT /api/mlt-reports/:testId/submit
 */
router.put(
  '/:testId/submit',
  requireRole(['MLT']),
  upload.single('test_report_file'),
  submitTestResults
);

// ============================================
// REPORT VIEWING
// ============================================

/**
 * 👁️ Get Test Report Details
 * GET /api/mlt-reports/:testId
 */
router.get(
  '/:testId',
  requireRole(['MLT', 'doctor', 'patient', 'admin']),
  getTestReportDetails
);

/**
 * 📊 Get Completed Reports (MLT's work)
 * GET /api/mlt-reports/completed/:mltId
 */
router.get(
  '/completed/:mltId',
  requireRole(['MLT']),
  getCompletedReports
);

// ============================================
// REPORT HISTORY
// ============================================

/**
 * 📜 Get Report Version History
 * GET /api/mlt-reports/:testId/history
 */
router.get(
  '/:testId/history',
  requireRole(['MLT']),
  getReportHistory
);

module.exports = router;