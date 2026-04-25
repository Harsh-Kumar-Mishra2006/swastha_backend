// routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const {
  checkAvailability,
  getAppointmentFormData,
  createPendingAppointment,
  getConfirmedAppointment,
  getMyAppointments,
  cancelAppointment,
  uploadReports,
  getPendingAppointmentWithPayment
} = require('../controllers/appointmentController');

// Apply auth middleware to each route individually (not globally)
// This prevents middleware issues

// Public availability check (no auth needed? Keep as is or add)
router.get('/check-availability', authenticateToken, authorizeRoles(['patient']), checkAvailability);
router.get('/book-form/:doctorId', authenticateToken, authorizeRoles(['patient']), getAppointmentFormData);
router.post('/create-pending', authenticateToken, authorizeRoles(['patient']), createPendingAppointment);
router.get('/confirmed/:appointmentId', authenticateToken, authorizeRoles(['patient']), getConfirmedAppointment);
router.get('/my-appointments', authenticateToken, authorizeRoles(['patient']), getMyAppointments);
router.put('/cancel/:appointmentId', authenticateToken, authorizeRoles(['patient']), cancelAppointment);
router.get('/pending-payment/:appointmentId', authenticateToken, authorizeRoles(['patient']), getPendingAppointmentWithPayment);
router.post('/upload-reports/:appointmentId', 
  authenticateToken, 
  authorizeRoles(['patient']),
  upload.array('reports', 5), 
  uploadReports
);

module.exports = router;