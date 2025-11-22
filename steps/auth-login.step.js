const { query } = require('../config/database');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  hashToken,
  comparePassword,
  getCookieOptions
} = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');

// Helper function to serialize cookie options to string
function serializeCookieOptions(options) {
  const parts = [];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  return parts.join('; ');
}

const config = {
  name: 'AuthLogin',
  type: 'api',
  path: '/api/auth/login',
  method: 'POST'
};

const handler = async (req, { logger }) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return { status: 400, body: { error: 'Email and password are required' } };
  }
  
  try {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      logActivity.security('LOGIN_FAILED', { email, reason: 'User not found', ip: req.headers['x-forwarded-for'] || 'unknown' });
      return { status: 401, body: { error: 'Invalid credentials' } };
    }
    
    const user = result.rows[0];
    const isValidPassword = await comparePassword(password, user.password_hash);
    
    if (!isValidPassword) {
      logActivity.security('LOGIN_FAILED', { email, userId: user.id, reason: 'Invalid password', ip: req.headers['x-forwarded-for'] || 'unknown' });
      return { status: 401, body: { error: 'Invalid credentials' } };
    }
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    // Store refresh token in database
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, expiresAt]
    );
    
    // Log audit
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ...requestInfo
    });
    
    logActivity.auth('LOGIN_SUCCESS', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...requestInfo
    });
    
    const { password_hash, ...userWithoutPassword } = user;
    
    // Set cookies via headers
    const cookieOptions = getCookieOptions(15 * 60 * 1000);
    const refreshCookieOptions = getCookieOptions(7 * 24 * 60 * 60 * 1000);
    
    return {
      status: 200,
      body: {
        user: userWithoutPassword,
        requiresPasswordChange: user.force_password_change
      },
      headers: {
        'Set-Cookie': [
          `accessToken=${accessToken}; ${serializeCookieOptions(cookieOptions)}`,
          `refreshToken=${refreshToken}; ${serializeCookieOptions(refreshCookieOptions)}`
        ]
      }
    };
  } catch (error) {
    logger.error('Login error:', error);
    logActivity.error(error, { context: 'login', email });
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
