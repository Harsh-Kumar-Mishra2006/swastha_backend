// routes/doctorRoutes.js
const express = require('express');
const router = express.Router();
const {
  getActiveDoctors,
  getPublicDoctorById,
  getSpecializations
} = require('../controllers/doctorController');

// Public routes - No authentication required
router.get('/doctors', getActiveDoctors);
router.get('/doctors/specializations', getSpecializations);
router.get('/doctors/:doctorId', getPublicDoctorById);

module.exports = router;