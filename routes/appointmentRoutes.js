// routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  bookAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  approveAppointment,
  rejectAppointment,
  getAppointmentDetails,
  cancelAppointment,
  verifyPayment,
  getAppointmentStats
} = require('../controllers/appointmentController');

// ✅ Import Cloudinary config
const { configureUpload } = require('../config/cloudinaryConfig');

// ✅ Configure multer upload
const upload = configureUpload({
  folder: 'appointment_payments',
  fileSize: 5 * 1024 * 1024, // 5MB
  allowed_formats: ['jpg', 'jpeg', 'png', 'pdf']
});

// ====================
// PUBLIC ROUTES (No auth required for booking)
// ====================

// 📌 Book appointment with payment screenshot
router.post(
  '/book',
  upload.single('payment_screenshot'), // ✅ Field name must match frontend
  bookAppointment
);

// 📌 Get available doctors (public)
router.get('/available-doctors', async (req, res) => {
  try {
    const Doctor = require('../models/doctorModel');
    const doctors = await Doctor.find({ status: 'active' })
      .select('name email specialization consultationFee availableDays availableTime');
    
    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('❌ Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================
// PATIENT ROUTES (Auth required)
// ====================

// 📌 Get patient's appointments
router.get(
  '/patient/:patient_email',
  authenticateToken,
  getPatientAppointments
);

// 📌 Get appointment details
router.get(
  '/:appointmentId',
  authenticateToken,
  getAppointmentDetails
);

// 📌 Cancel appointment (patient)
router.put(
  '/:appointmentId/cancel',
  authenticateToken,
  cancelAppointment
);

// ====================
// DOCTOR ROUTES (Auth + Role check)
// ====================

// 📌 Get doctor's appointments (Doctor Portal)
router.get(
  '/doctor/:doctor_email',
  authenticateToken,
  getDoctorAppointments
);

// 📌 Approve appointment
router.put(
  '/:appointmentId/approve',
  authenticateToken,
  approveAppointment
);

// 📌 Reject appointment
router.put(
  '/:appointmentId/reject',
  authenticateToken,
  rejectAppointment
);

// ====================
// ADMIN ROUTES
// ====================

// 📌 Verify payment
router.put(
  '/:appointmentId/verify-payment',
  authenticateToken,
  verifyPayment
);

// 📌 Get appointment statistics
router.get(
  '/admin/stats',
  authenticateToken,
  getAppointmentStats
);

// ✅ Error handling middleware for multer
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 5MB.'
    });
  }
  
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  
  next(err);
});

module.exports = router;