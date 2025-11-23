/**
 * Cookie utilities for Motia framework
 * Handles cookie parsing and serialization
 */

/**
 * Parse cookies from request header string
 * @param {string} cookieHeader - The cookie header string from req.headers.cookie
 * @returns {Object} Object with cookie name-value pairs
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      // Decode URI component to handle special characters
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

/**
 * Serialize cookie options to Set-Cookie header string format
 * @param {Object} options - Cookie options object
 * @param {boolean} options.httpOnly - HttpOnly flag
 * @param {boolean} options.secure - Secure flag
 * @param {string} options.sameSite - SameSite attribute (Strict, Lax, None)
 * @param {number} options.maxAge - Max age in milliseconds
 * @param {string} options.path - Cookie path
 * @returns {string} Serialized cookie options string
 */
function serializeCookieOptions(options) {
  const parts = [];
  
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  
  return parts.join('; ');
}

/**
 * Create a complete Set-Cookie header value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} options - Cookie options
 * @returns {string} Complete Set-Cookie header value
 */
function createSetCookieHeader(name, value, options) {
  const encodedValue = encodeURIComponent(value);
  const optionsString = serializeCookieOptions(options);
  return `${name}=${encodedValue}; ${optionsString}`;
}

module.exports = {
  parseCookies,
  serializeCookieOptions,
  createSetCookieHeader
};
