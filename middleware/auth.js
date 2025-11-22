const { verifyAccessToken } = require('../utils/auth');

// Helper to parse cookies from request headers
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = value;
    return cookies;
  }, {});
}

// Authentication middleware for Motia
async function authenticate(req, ctx, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const accessToken = cookies.accessToken;
    
    if (!accessToken) {
      return { status: 401, body: { error: 'Authentication required' } };
    }
    
    const payload = verifyAccessToken(accessToken);
    
    if (!payload) {
      return { status: 401, body: { error: 'Invalid or expired token' } };
    }
    
    req.user = payload;
    return next();
  } catch (error) {
    ctx.logger.error('Authentication error:', error);
    return { status: 401, body: { error: 'Authentication failed' } };
  }
}

// Role-based authorization middleware for Motia
function authorize(...allowedRoles) {
  return async (req, ctx, next) => {
    if (!req.user) {
      return { status: 401, body: { error: 'Authentication required' } };
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return { status: 403, body: { error: 'Insufficient permissions' } };
    }
    
    return next();
  };
}

// Admin only middleware
async function adminOnly(req, ctx, next) {
  return authorize('admin')(req, ctx, next);
}

// Manager and admin middleware
async function managerOrAdmin(req, ctx, next) {
  return authorize('admin', 'manager')(req, ctx, next);
}

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  managerOrAdmin
};
