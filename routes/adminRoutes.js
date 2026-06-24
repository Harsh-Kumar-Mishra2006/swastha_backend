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
const { authenticateToken } = require('../middlewares/authMiddleware');
const adminAuth = require('../middlewares/adminAuthMiddleware');
const { doctorAuth, adminOrDoctorAuth } = require('../middlewares/doctorAuthMiddleware');

const Doctor = require('../models/doctorModel');
const MLT = require('../models/mltModel');

// Apply authentication to all routes
router.use(authenticateToken);

// ==================== DOCTOR MANAGEMENT (Admin Only) ====================
router.post('/doctors', adminAuth, addDoctor);
router.get('/doctors', adminAuth, getAllDoctors);
router.get('/doctors/pending', adminAuth, getPendingDoctors);
router.get('/doctors/:doctorId', adminAuth, getDoctorById);
router.put('/doctors/:doctorId/status', adminAuth, updateDoctorStatus);
router.post('/doctors/:doctorId/reset-password', adminAuth, resetDoctorPassword);
router.delete('/doctors/:doctorId', adminAuth, deleteDoctor);
router.put('/doctors/:doctorId', adminAuth, updateDoctorProfile);
router.get('/doctors/stats', adminAuth, getDoctorStats);

// ==================== MLT ROUTES ====================

// 🔐 Admin-only MLT management operations
router.post('/mlt', adminAuth, addMLT);
router.put('/mlt/:mltId/status', adminAuth, updateMLTStatus);
router.put('/mlt/:mltId', adminAuth, updateMLTProfile);
router.delete('/mlt/:mltId', adminAuth, deleteMLT);
router.post('/mlt/:mltId/reset-password', adminAuth, resetMLTPassword);
router.get('/mlt/stats', adminAuth, getMLTStats);

// 👁️ View MLTs - Both Admin and Doctor can view
router.get('/mlt', adminOrDoctorAuth, getAllMLTs);
router.get('/mlt/:mltId', adminOrDoctorAuth, getMLTById);

// ==================== DOCTOR-SPECIFIC ROUTES ====================
// Routes that only doctors can access (if any)
router.get('/doctor/dashboard', doctorAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Doctor dashboard data',
    data: {
      // Doctor-specific data
    }
  });
});

// Example: Doctor can view their own patients
router.get('/doctor/patients', doctorAuth, async (req, res) => {
  try {
    // Your logic here
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Example: Doctor can view their appointments
router.get('/doctor/appointments', doctorAuth, async (req, res) => {
  try {
    // Your logic here
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== COMBINED STATS (Admin Only) ====================
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const doctorStats = await Doctor.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }
    ]);
    
    const mltStats = await MLT.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } }
    ]);
    
    res.json({
      success: true,
      data: {
        doctors: doctorStats[0] || { total: 0, active: 0 },
        mlt: mltStats[0] || { total: 0, active: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;