const { query } = require('../config/database');
const { verifyRefreshToken, generateAccessToken, hashToken, getCookieOptions } = require('../utils/auth');
const { parseCookies, createSetCookieHeader } = require('../utils/cookies');

const config = {
  emits: [],
  name: 'AuthRefresh',
  type: 'api',
  path: '/api/auth/refresh',
  method: 'POST'
};

const handler = async (req, { logger }) => {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.refreshToken;

  if (!refreshToken) {
    return { status: 401, body: { error: 'Refresh token required' } };
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      return { status: 401, body: { error: 'Invalid refresh token' } };
    }

    const refreshTokenHash = hashToken(refreshToken);

    const result = await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > NOW()',
      [refreshTokenHash, payload.userId]
    );

    if (result.rows.length === 0) {
      return { status: 401, body: { error: 'Invalid or expired refresh token' } };
    }

    const userResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return { status: 401, body: { error: 'User not found' } };
    }

    const user = userResult.rows[0];

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const cookieOptions = getCookieOptions(15 * 60 * 1000);
    const { password_hash, ...userWithoutPassword } = user;

    return {
      status: 200,
      body: {
        user: userWithoutPassword,
        requiresPasswordChange: user.force_password_change,
        expiresAt: Date.now() + 15 * 60 * 1000
      },
      headers: {
        'Set-Cookie': createSetCookieHeader('accessToken', newAccessToken, cookieOptions)
      }
    };
  } catch (error) {
    logger.error('Refresh token error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
