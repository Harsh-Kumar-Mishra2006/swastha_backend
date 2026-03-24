// authRoutes.js
const express = require('express');
const jwt= require('jsonwebtoken');
const { login, signup, logout, getProfile, updateProfile, checkDoctorAuthorization,debugToken } = require('../controllers/authController');
const authenticateToken = require('../middlewares/authMiddleware'); 
const auth= require('../models/authModel');
const doctor= require('../models/doctorModel');
const router = express.Router();

// PUBLIC ROUTES 
router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', logout);

// PROTECTED ROUTES 
router.get('/profile', getProfile);
router.get('/debug-token', debugToken);
router.put('/profile', authenticateToken, updateProfile);
router.get('/check-doctor', authenticateToken, checkDoctorAuthorization); 

// Debug route 
router.get('/debug-auth', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const user = await Auth.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const doctor = await Doctor.findOne({ email: user.email });
    
    res.json({
      tokenData: decoded,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive
      },
      doctorProfile: doctor ? {
        id: doctor._id,
        email: doctor.email,
        status: doctor.status,
        specialization: doctor.specialization
      } : null,
      checks: {
        isDoctor: user.role === 'doctor',
        isVerified: user.isVerified,
        isActive: user.isActive,
        hasDoctorProfile: !!doctor,
        doctorStatus: doctor?.status,
        isFullyAuthorized: user.role === 'doctor' && 
                          user.isVerified && 
                          user.isActive && 
                          doctor && 
                          doctor.status === 'active'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;