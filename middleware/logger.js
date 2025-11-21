const { logActivity } = require('../utils/logger');

// Middleware to log all API requests
function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const userId = req.user ? req.user.userId : null;
    
    logActivity.api(
      req.method,
      req.path,
      res.statusCode,
      userId,
      duration,
      {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        query: req.query,
        body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined
      }
    );
  });
  
  next();
}

// Sanitize request body to avoid logging sensitive data
function sanitizeBody(body) {
  if (!body) return undefined;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'token', 'accessToken', 'refreshToken'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

module.exports = { requestLogger };
