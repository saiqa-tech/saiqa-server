const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, adminOnly } = require('../middleware/auth');

const config = {
  emits: [],
  name: 'UsersDelete',
  type: 'api',
  path: '/api/users/:id',
  method: 'DELETE',
  middleware: [authenticate, adminOnly]
};

const handler = async (req, { logger }) => {
  const userId = req.pathParams.id;
  
  try {
    // Get user data before deletion
    const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return { status: 404, body: { error: 'User not found' } };
    }
    
    const user = userResult.rows[0];
    
    // RBAC: Prevent deleting yourself
    if (userId === req.user.userId) {
      return { status: 400, body: { error: 'Cannot delete your own account' } };
    }
    
    // RBAC: Only admins can delete admin users (additional safeguard)
    // This is redundant with adminOnly middleware but provides defense in depth
    if (user.role === 'admin' && req.user.role !== 'admin') {
      return { status: 403, body: { error: 'Only admins can delete admin users' } };
    }
    
    // Soft delete: set is_active to false instead of actual deletion
    await query(
      'UPDATE users SET is_active = false, updated_by = $1 WHERE id = $2',
      [req.user.userId, userId]
    );
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'user',
      entityId: userId,
      changes: { old: user },
      ...requestInfo
    });
    
    logActivity.user('DELETE_USER', userId, {
      deletedBy: req.user.userId,
      email: user.email,
      ...requestInfo
    });
    
    return { status: 200, body: { message: 'User deleted successfully' } };
  } catch (error) {
    logger.error('Delete user error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
