// middlewares/adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const Auth = require('../models/authModel');

const adminAuth = async (req, res, next) => {
  try {
    console.log('🔐 Admin Authorization Check');
    
    // Get token from header or cookie
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, 'mypassword');
    console.log('✅ Token verified for user:', decoded.userId);

    // Find user
    const user = await Auth.findById(decoded.userId);
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('❌ User is not admin. Role:', user.role);
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Check if admin is active
    if (!user.isActive) {
      console.log('❌ Admin account is inactive');
      return res.status(403).json({
        success: false,
        error: 'Admin account is deactivated'
      });
    }

    console.log('✅ Admin authorized:', user.email);
    
    // Attach user to request
    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    
    next();
    
  } catch (error) {
    console.log('❌ Admin auth error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

module.exports = adminAuth;