/**
 * Request utilities for extracting client information
 */

/**
 * Get client IP address from request
 * Checks X-Forwarded-For header first (for proxied requests), then falls back to direct IP
 * @param {Object} req - Request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  // Check X-Forwarded-For header (proxied requests)
  const forwardedFor = req.headers['x-forwarded-for'];
  
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one (client IP)
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // Fall back to direct connection IP
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Get user agent from request headers
 * @param {Object} req - Request object
 * @returns {string} User agent string
 */
function getUserAgent(req) {
  return req.headers['user-agent'] || 'unknown';
}

module.exports = {
  getClientIP,
  getUserAgent
};
