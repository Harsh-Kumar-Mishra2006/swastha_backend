// routes/authRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { login, signup, logout, getProfile, updateProfile, checkDoctorAuthorization, checkMLTAuthorization, debugToken } = require('../controllers/authController');
const authenticateToken = require('../middlewares/authMiddleware'); 
const auth = require('../models/authModel'); // Fixed: changed 'Auth' to 'auth'
const doctor = require('../models/doctorModel');
const router = express.Router();

// PUBLIC ROUTES 
router.post('/login', login);
router.post('/signup', signup);
router.post('/logout', logout);

// PROTECTED ROUTES 
router.get('/profile', authenticateToken, getProfile);
router.get('/debug-token', debugToken);
router.put('/profile', authenticateToken, updateProfile);
router.get('/check-mlt', authenticateToken, checkMLTAuthorization);
router.get('/check-doctor', authenticateToken, checkDoctorAuthorization); 

// Debug route - Fixed model reference
router.get('/debug-auth', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const decoded = jwt.verify(token, 'mypassword');
    const user = await auth.findById(decoded.userId); // Fixed: changed 'Auth' to 'auth'
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const doctorProfile = await doctor.findOne({ email: user.email });
    
    res.json({
      tokenData: decoded,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isActive: user.isActive
      },
      doctorProfile: doctorProfile ? {
        id: doctorProfile._id,
        email: doctorProfile.email,
        status: doctorProfile.status,
        specialization: doctorProfile.specialization
      } : null,
      checks: {
        isDoctor: user.role === 'doctor',
        isVerified: user.isVerified,
        isActive: user.isActive,
        hasDoctorProfile: !!doctorProfile,
        doctorStatus: doctorProfile?.status,
        isFullyAuthorized: user.role === 'doctor' && 
                          user.isVerified && 
                          user.isActive && 
                          doctorProfile && 
                          doctorProfile.status === 'active'
      }
    });
    
  } catch (error) {
    console.error('Debug auth error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;