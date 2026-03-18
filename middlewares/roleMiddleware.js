const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // User should be attached by authenticateToken middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
};

module.exports = authorizeRoles;