const { query } = require('../config/database');
const { comparePassword, hashPassword } = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

const config = {
  name: 'AuthChangePassword',
  type: 'api',
  path: '/api/auth/change-password',
  method: 'POST',
  middleware: [authenticate]
};

const handler = async (req, { logger }) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;
  
  if (!currentPassword || !newPassword) {
    return { status: 400, body: { error: 'Current and new password are required' } };
  }
  
  if (newPassword.length < 8) {
    return { status: 400, body: { error: 'Password must be at least 8 characters' } };
  }
  
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return { status: 404, body: { error: 'User not found' } };
    }
    
    const user = result.rows[0];
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return { status: 401, body: { error: 'Current password is incorrect' } };
    }
    
    const newPasswordHash = await hashPassword(newPassword);
    
    await query(
      'UPDATE users SET password_hash = $1, force_password_change = false, updated_by = $2 WHERE id = $3',
      [newPasswordHash, userId, userId]
    );
    
    // Delete all refresh tokens for this user to force re-login on other devices
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: userId,
      action: 'CHANGE_PASSWORD',
      entityType: 'user',
      entityId: userId,
      ...requestInfo
    });
    
    logActivity.auth('PASSWORD_CHANGED', {
      userId,
      ...requestInfo
    });
    
    return { status: 200, body: { message: 'Password changed successfully' } };
  } catch (error) {
    logger.error('Change password error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
