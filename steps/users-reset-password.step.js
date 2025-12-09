const { query } = require('../config/database');
const { hashPassword } = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, adminOnly } = require('../middleware/auth');

const config = {
  emits: [],
  name: 'UsersResetPassword',
  type: 'api',
  path: '/api/users/:id/reset-password',
  method: 'POST',
  middleware: [authenticate, adminOnly]
};

const handler = async (req, { logger }) => {
  const userId = req.pathParams.id;
  const { newPassword } = req.body;
  
  if (!newPassword) {
    return { status: 400, body: { error: 'New password is required' } };
  }
  
  if (newPassword.length < 8) {
    return { status: 400, body: { error: 'Password must be at least 8 characters' } };
  }
  
  try {
    // Check if user exists
    const userResult = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return { status: 404, body: { error: 'User not found' } };
    }
    
    const user = userResult.rows[0];
    
    // Hash new password
    const passwordHash = await hashPassword(newPassword);
    
    // Update password and force password change
    await query(
      `UPDATE users 
       SET password_hash = $1, force_password_change = true, updated_by = $2
       WHERE id = $3`,
      [passwordHash, req.user.userId, userId]
    );
    
    // Invalidate all refresh tokens for this user
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: userId,
      ...requestInfo
    });
    
    logActivity.security('RESET_PASSWORD', {
      userId,
      email: user.email,
      resetBy: req.user.userId,
      ...requestInfo
    });
    
    return { 
      status: 200, 
      body: { 
        message: 'Password reset successfully. User will be required to change password on next login.' 
      } 
    };
  } catch (error) {
    logger.error('Reset password error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
