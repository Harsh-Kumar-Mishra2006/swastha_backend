const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    console.log('Authenticating token...');
    
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;
    
    console.log('Token exists:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ 
        success: false,
        error: 'Access denied. No token provided.' 
      });
    }

    const verified = jwt.verify(token, 'mypassword');
    console.log('Token verified for userId:', verified.userId);
    
    req.user = verified;
    next();
    
  } catch (error) {
    console.log('Token verification failed:', error.message);
    res.status(401).json({ 
      success: false,
      error: 'Invalid token' 
    });
  }
};

// ✅ Role-based middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    
    next();
  };
};
module.exports = { authenticateToken, requireRole };