// middlewares/doctorAuthMiddleware.js
const doctorAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  // Check if user is a doctor
  if (req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Doctor role required.'
    });
  }
  
  next();
};

// Optional: Middleware that allows both admin and doctor
const adminOrDoctorAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin or Doctor role required.'
    });
  }
  
  next();
};

module.exports = { doctorAuth, adminOrDoctorAuth };