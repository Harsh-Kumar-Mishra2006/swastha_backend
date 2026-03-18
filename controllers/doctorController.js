// controllers/doctorController.js
const Doctor = require('../models/doctorModel');

// Get all active doctors for public viewing
const getActiveDoctors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;
    const specialization = req.query.specialization;

    let query = { status: 'active' }; // Only show active doctors
    if (specialization && specialization !== 'all') {
      query.specialization = specialization;
    }

    const doctors = await Doctor.find(query)
      .select('-password -addedBy') // Exclude password and addedBy
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Doctor.countDocuments(query);

    // Get unique specializations for filter
    const specializations = await Doctor.distinct('specialization', { status: 'active' });

    res.json({
      success: true,
      data: doctors,
      specializations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get single doctor by ID for public viewing
const getPublicDoctorById = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    const doctor = await Doctor.findById(doctorId)
      .select('-password -addedBy');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    // Only show active doctors to public
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
};

// Get all specializations for filter
const getSpecializations = async (req, res) => {
  try {
    const specializations = await Doctor.distinct('specialization', { status: 'active' });
    
    res.json({
      success: true,
      data: specializations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  getActiveDoctors,
  getPublicDoctorById,
  getSpecializations
};