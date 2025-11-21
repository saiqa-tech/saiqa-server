const { verifyAccessToken } = require('../utils/auth');

// Authentication middleware
async function authenticate(req, res, next) {
  try {
    const accessToken = req.cookies.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const payload = verifyAccessToken(accessToken);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = payload;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Role-based authorization middleware
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Admin only middleware
function adminOnly(req, res, next) {
  return authorize('admin')(req, res, next);
}

// Manager and admin middleware
function managerOrAdmin(req, res, next) {
  return authorize('admin', 'manager')(req, res, next);
}

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  managerOrAdmin
};
