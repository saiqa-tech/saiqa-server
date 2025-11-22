const { query } = require('../config/database');
const { hashToken } = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');

// Helper to parse cookies
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = value;
    return cookies;
  }, {});
}

const config = {
  name: 'AuthLogout',
  type: 'api',
  path: '/api/auth/logout',
  method: 'POST'
};

const handler = async (req, { logger }) => {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.refreshToken;
  
  try {
    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshTokenHash]);
    }
    
    if (req.user) {
      const requestInfo = getRequestInfo(req);
      await logAudit({
        userId: req.user.userId,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user.userId,
        ...requestInfo
      });
      
      logActivity.auth('LOGOUT', {
        userId: req.user.userId,
        ...requestInfo
      });
    }
    
    return {
      status: 200,
      body: { message: 'Logged out successfully' },
      headers: {
        'Set-Cookie': [
          'accessToken=; Max-Age=0; Path=/',
          'refreshToken=; Max-Age=0; Path=/'
        ]
      }
    };
  } catch (error) {
    logger.error('Logout error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
