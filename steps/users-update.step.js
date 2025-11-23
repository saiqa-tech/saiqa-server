const { query } = require('../config/database');
const { hashPassword } = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  name: 'UsersUpdate',
  type: 'api',
  path: '/api/users/:id',
  method: 'PUT',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const userId = req.pathParams.id;
  const { 
    firstName, 
    lastName, 
    role, 
    unitId, 
    designationId, 
    isActive,
    metadata = {} 
  } = req.body;
  
  // Validate at least one field to update
  if (!firstName && !lastName && !role && unitId === undefined && 
      designationId === undefined && isActive === undefined && Object.keys(metadata).length === 0) {
    return { status: 400, body: { error: 'At least one field must be provided for update' } };
  }
  
  // Validate role if provided
  if (role && !['admin', 'manager', 'user'].includes(role)) {
    return { status: 400, body: { error: 'Invalid role' } };
  }
  
  try {
    // Get current user data
    const currentUserResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (currentUserResult.rows.length === 0) {
      return { status: 404, body: { error: 'User not found' } };
    }
    
    const currentUser = currentUserResult.rows[0];
    
    // RBAC: Prevent privilege escalation
    // Admins can update anyone (including other admins)
    // Managers can only update non-admin users (users and managers)
    // Users cannot update others (handled by managerOrAdmin middleware)
    if (req.user.role !== 'admin' && currentUser.role === 'admin') {
      return { status: 403, body: { error: 'Only admins can update admin users' } };
    }
    
    // RBAC: Only admins can change roles
    if (role && role !== currentUser.role) {
      if (req.user.role !== 'admin') {
        return { status: 403, body: { error: 'Only admins can change user roles' } };
      }
      
      // RBAC: Prevent managers from being promoted to admin by other managers
      if (role === 'admin' && req.user.role !== 'admin') {
        return { status: 403, body: { error: 'Only admins can grant admin privileges' } };
      }
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (firstName) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    
    if (lastName) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    
    if (unitId !== undefined) {
      updates.push(`unit_id = $${paramCount++}`);
      values.push(unitId || null);
    }
    
    if (designationId !== undefined) {
      updates.push(`designation_id = $${paramCount++}`);
      values.push(designationId || null);
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }
    
    if (Object.keys(metadata).length > 0) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(metadata));
    }
    
    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.user.userId);
    
    values.push(userId);
    
    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, first_name, last_name, role, unit_id, designation_id, 
                 is_active, force_password_change, metadata, created_at, updated_at`,
      values
    );
    
    const updatedUser = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: updatedUser.id,
      changes: { 
        old: currentUser,
        new: updatedUser 
      },
      ...requestInfo
    });
    
    logActivity.user('UPDATE_USER', updatedUser.id, {
      updatedBy: req.user.userId,
      changes: req.body,
      ...requestInfo
    });
    
    return { status: 200, body: { user: updatedUser } };
  } catch (error) {
    logger.error('Update user error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
