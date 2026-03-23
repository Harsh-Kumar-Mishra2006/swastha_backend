// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const {
  addDoctor,
  getAllDoctors,
  getDoctorById,
  updateDoctorStatus,
  getPendingDoctors,
  getDoctorStats,
  deleteDoctor,
  resetDoctorPassword,
  updateDoctorProfile,
  addMLT,
  getAllMLTs,
  getMLTById,
  updateMLTStatus,
  updateMLTProfile,
  deleteMLT,
  resetMLTPassword,
  getMLTStats
} = require('../controllers/adminController');
const authenticateToken = require('../middlewares/authMiddleware');
const adminAuth = require('../middlewares/adminAuthMiddleware');

// Apply authentication to all admin routes
router.use(authenticateToken);

// Admin-only routes (using adminAuth middleware)
// Doctor management
router.post('/doctors', adminAuth, addDoctor);
router.get('/doctors', adminAuth, getAllDoctors);
router.get('/doctors/pending', adminAuth, getPendingDoctors);
router.get('/doctors/:doctorId', adminAuth, getDoctorById);
router.put('/doctors/:doctorId/status', adminAuth, updateDoctorStatus);
router.post('/doctors/:doctorId/reset-password', adminAuth, resetDoctorPassword);
router.delete('/doctors/:doctorId', adminAuth, deleteDoctor);
// In adminRoutes.js
router.put('/doctors/:doctorId', adminAuth, updateDoctorProfile);

// Statistics 
router.get('/stats', adminAuth, getDoctorStats);

// ==================== MLT ROUTES ====================
router.post('/mlt', adminAuth, addMLT);
router.get('/mlt', adminAuth, getAllMLTs);
router.get('/mlt/:mltId', adminAuth, getMLTById);
router.put('/mlt/:mltId/status', adminAuth, updateMLTStatus);
router.put('/mlt/:mltId', adminAuth, updateMLTProfile);
router.delete('/mlt/:mltId', adminAuth, deleteMLT);
router.post('/mlt/:mltId/reset-password', adminAuth, resetMLTPassword);
router.get('/mlt/stats', adminAuth, getMLTStats);

// Statistics (combined)
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const doctorStats = await getDoctorStats(req, res);
    const mltStats = await getMLTStats(req, res);
    // Combine stats if needed
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;