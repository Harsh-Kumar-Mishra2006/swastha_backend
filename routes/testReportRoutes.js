// routes/testReportRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const {authenticateToken} = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/authMiddleware');
const {
  createTestRequest,
  getDoctorTestRequests,
  getMLTTestRequests,
  startTest,
  submitTestResults,
  acceptAssignment,
  rejectAssignment,
  getTestRequestDetails,
  getTestStatistics,
  getPatientsForDoctor
} = require('../controllers/testReportController');

// ✅ Configure Cloudinary for test reports
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

// ✅ Configure Multer with Cloudinary
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
    const allowedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.some(type => file.mimetype.startsWith(type) || file.mimetype === type)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDF, and Word documents are allowed'), false);
    }
  }
});

// ====================
// DOCTOR ROUTES
// ====================

// 📌 Create test request (Doctor)
router.post(
  '/create',
  authenticateToken,
  requireRole(['doctor']),
  createTestRequest
);

// 📌 Get doctor's test requests
router.get(
  '/doctor/:doctorId',
  authenticateToken,
  requireRole(['doctor']),
  getDoctorTestRequests
);

// 📌 Get doctor's test statistics
router.get(
  '/doctor/:doctorId/statistics',
  authenticateToken,
  requireRole(['doctor']),
  getTestStatistics
);

// 📌 Get patients for doctor (for dropdown)
router.get(
  '/doctor/:doctorId/patients',
  authenticateToken,
  requireRole(['doctor']),
  getPatientsForDoctor
);

// ====================
// MLT ROUTES
// ====================

// 📌 Get MLT's assigned test requests
router.get(
  '/mlt/:mltId',
  authenticateToken,
  requireRole(['MLT']),
  getMLTTestRequests
);

// 📌 Accept assignment (MLT)
router.put(
  '/:testId/accept',
  authenticateToken,
  requireRole(['MLT']),
  acceptAssignment
);

// 📌 Reject assignment (MLT)
router.put(
  '/:testId/reject',
  authenticateToken,
  requireRole(['MLT']),
  rejectAssignment
);

// 📌 Start test (MLT)
router.put(
  '/:testId/start',
  authenticateToken,
  requireRole(['MLT']),
  startTest
);

// 📌 Submit test results (MLT)
router.put(
  '/:testId/submit',
  authenticateToken,
  requireRole(['MLT']),
  upload.single('test_report_file'),
  submitTestResults
);

// ====================
// SHARED ROUTES
// ====================

// 📌 Get test request details
router.get(
  '/:testId',
  authenticateToken,
  getTestRequestDetails
);

module.exports = router;