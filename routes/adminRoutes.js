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
  updateDoctorProfile
} = require('../controllers/adminController');
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
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

module.exports = router;