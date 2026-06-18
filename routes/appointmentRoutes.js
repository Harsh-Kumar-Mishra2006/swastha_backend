// routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const {authenticateToken} = require('../middlewares/authMiddleware');
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

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret'
});

// ✅ Configure Multer with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'appointment_payments',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'), false);
    }
  }
});

// ====================
// PUBLIC ROUTES (No auth required for booking)
// ====================

// 📌 Book appointment with payment screenshot
router.post(
  '/book',
  upload.single('payment_screenshot'),
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

module.exports = router;