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
  uploadReports, // Now this exists!
  getPendingAppointmentWithPayment // Add this

} = require('../controllers/appointmentController');

// All routes require authentication and patient role
router.use(authenticateToken);
router.use(authorizeRoles(['patient']));

// Appointment routes
router.get('/check-availability', checkAvailability);
router.get('/book-form/:doctorId', getAppointmentFormData);
router.post('/create-pending', createPendingAppointment);
router.get('/confirmed/:appointmentId', getConfirmedAppointment);
router.get('/my-appointments', getMyAppointments);
router.put('/cancel/:appointmentId', cancelAppointment);
// Add this to your appointmentRoutes.js
router.get('/pending-payment/:appointmentId', getPendingAppointmentWithPayment);

// Fixed upload route - now with controller function
router.post('/upload-reports/:appointmentId', 
  upload.array('reports', 5), 
  uploadReports // Added the missing controller
);

module.exports = router;