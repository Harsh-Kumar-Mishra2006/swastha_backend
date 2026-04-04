// routes/testReportRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const {
  // Doctor endpoints
  createReport,
  getDoctorReports,
  getDoctorReportById,
  updateDoctorReport,
  assignToMLT,
  
  // MLT endpoints
  getMLTReports,
  getMLTReportById,
  acceptReport,
  updateTestResult,
  completeReport,
  
  // Shared endpoints
  getReportById,
  getAvailableMLTs
} = require('../controllers/testReportController');

// ==================== DOCTOR ONLY ROUTES ====================
router.use(authenticateToken);

// Get available MLTs (both roles can see)
router.get('/available-mlts', getAvailableMLTs);

// Doctor specific routes
router.post('/create', authorizeRoles(['doctor']), createReport);
router.get('/doctor/my-reports', authorizeRoles(['doctor']), getDoctorReports);
router.get('/doctor/:reportId', authorizeRoles(['doctor']), getDoctorReportById);
router.put('/doctor/:reportId', authorizeRoles(['doctor']), updateDoctorReport);
router.post('/doctor/:reportId/assign', authorizeRoles(['doctor']), assignToMLT);

// MLT specific routes
router.get('/mlt/my-reports', authorizeRoles(['MLT']), getMLTReports);
router.get('/mlt/:reportId', authorizeRoles(['MLT']), getMLTReportById);
router.put('/mlt/:reportId/accept', authorizeRoles(['MLT']), acceptReport);
router.put('/mlt/:reportId/tests/:testIndex', authorizeRoles(['MLT']), updateTestResult);
router.put('/mlt/:reportId/complete', authorizeRoles(['MLT']), completeReport);

// Shared route (both doctor and MLT can access their own reports)
router.get('/:reportId', getReportById);

module.exports = router;