// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const Doctor = require('../models/doctorModel');

// Get all doctors (public)
router.get('/doctors', async (req, res) => {
  try {
    const { page = 1, limit = 10, specialization } = req.query;
    const query = { status: 'active' };
    
    if (specialization) {
      query.specialization = specialization;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const doctors = await Doctor.find(query)
      .select('-password -__v')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Doctor.countDocuments(query);
    
    // Get unique specializations for filters
    const specializations = await Doctor.distinct('specialization', { status: 'active' });

    res.json({
      success: true,
      data: doctors,
      specializations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single doctor by ID (public)
router.get('/doctors/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id)
      .select('-password -__v');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    if (doctor.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Doctor not available'
      });
    }

    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;