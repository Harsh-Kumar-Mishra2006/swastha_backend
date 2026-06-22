// routes/prescriptionRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  createPrescription,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  getPrescriptionDetails,
  updatePrescription,
  dispensePrescription,
  cancelPrescription,
  getPrescriptionStats
} = require('../controllers/PrescriptionController');

// ============================================
// ✅ PUBLIC / PATIENT ROUTES
// ============================================

// 📌 Get patient's prescriptions (Patient Portal)
router.get(-
  '/patient/:patient_email',
  authenticateToken,
  getPatientPrescriptions
);

// 📌 Get prescription details (Patient can view)
router.get(
  '/:prescriptionId',
  authenticateToken,
  getPrescriptionDetails
);

// ============================================
// ✅ DOCTOR ROUTES
// ============================================

// 📌 Create prescription (Doctor only)
router.post(
  '/create',
  authenticateToken,
  createPrescription
);

// 📌 Get doctor's prescriptions (Doctor Portal)
router.get(
  '/doctor/:doctor_email',
  authenticateToken,
  getDoctorPrescriptions
);

// 📌 Update prescription (Doctor only)
router.put(
  '/:prescriptionId',
  authenticateToken,
  updatePrescription
);

// 📌 Cancel prescription (Doctor/Admin)
router.put(
  '/:prescriptionId/cancel',
  authenticateToken,
  cancelPrescription
);

// ============================================
// ✅ ADMIN / PHARMACY ROUTES
// ============================================

// 📌 Dispense prescription (Pharmacy/Admin)
router.put(
  '/:prescriptionId/dispense',
  authenticateToken,
  dispensePrescription
);

// 📌 Get prescription statistics (Admin)
router.get(
  '/admin/stats',
  authenticateToken,
  getPrescriptionStats
);

// ============================================
// ✅ ERROR HANDLING
// ============================================
router.use((err, req, res, next) => {
  console.error('❌ Prescription Route Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

module.exports = router;