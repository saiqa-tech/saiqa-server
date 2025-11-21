const { query } = require('../config/database');
const { hashPassword } = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');

// Get all users with pagination and filters
async function getUsers(req, res) {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    role = '', 
    unitId = '', 
    isActive = '' 
  } = req.query;
  
  const offset = (page - 1) * limit;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    
    if (unitId) {
      whereConditions.push(`u.unit_id = $${paramIndex}`);
      params.push(unitId);
      paramIndex++;
    }
    
    if (isActive !== '') {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    params.push(limit, offset);
    
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.unit_id, u.designation_id,
              u.is_active, u.force_password_change, u.metadata, u.created_at, u.updated_at,
              un.name as unit_name, d.title as designation_title,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM users u
       LEFT JOIN units un ON u.unit_id = un.id
       LEFT JOIN designations d ON u.designation_id = d.id
       LEFT JOIN users creator ON u.created_by = creator.id
       LEFT JOIN users updater ON u.updated_by = updater.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get user by ID
async function getUserById(req, res) {
  const { id } = req.params;
  
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.unit_id, u.designation_id,
              u.is_active, u.force_password_change, u.metadata, u.created_at, u.updated_at,
              un.name as unit_name, d.title as designation_title,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM users u
       LEFT JOIN units un ON u.unit_id = un.id
       LEFT JOIN designations d ON u.designation_id = d.id
       LEFT JOIN users creator ON u.created_by = creator.id
       LEFT JOIN users updater ON u.updated_by = updater.id
       WHERE u.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Create user
async function createUser(req, res) {
  const { 
    email, 
    password, 
    firstName, 
    lastName, 
    role, 
    unitId, 
    designationId, 
    metadata = {} 
  } = req.body;
  
  if (!email || !password || !firstName || !lastName || !role) {
    return res.status(400).json({ error: 'Required fields: email, password, firstName, lastName, role' });
  }
  
  if (!['admin', 'manager', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  try {
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const passwordHash = await hashPassword(password);
    
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, unit_id, designation_id, 
                          force_password_change, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
       RETURNING id, email, first_name, last_name, role, unit_id, designation_id, is_active, 
                 force_password_change, metadata, created_at, updated_at`,
      [email, passwordHash, firstName, lastName, role, unitId || null, designationId || null, 
       JSON.stringify(metadata), req.user.userId]
    );
    
    const newUser = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      entityType: 'user',
      entityId: newUser.id,
      changes: { new: newUser },
      ...requestInfo
    });
    
    logActivity.user('CREATE_USER', newUser.id, {
      createdBy: req.user.userId,
      email: newUser.email,
      role: newUser.role,
      ...requestInfo
    });
    
    return res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update user
async function updateUser(req, res) {
  const { id } = req.params;
  const { 
    email, 
    firstName, 
    lastName, 
    role, 
    unitId, 
    designationId, 
    isActive,
    metadata 
  } = req.body;
  
  try {
    const existingResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const existingUser = existingResult.rows[0];
    
    if (email && email !== existingUser.email) {
      const emailCheck = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    }
    
    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(firstName);
      paramIndex++;
    }
    
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(lastName);
      paramIndex++;
    }
    
    if (role !== undefined) {
      if (!['admin', 'manager', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    
    if (unitId !== undefined) {
      updates.push(`unit_id = $${paramIndex}`);
      params.push(unitId || null);
      paramIndex++;
    }
    
    if (designationId !== undefined) {
      updates.push(`designation_id = $${paramIndex}`);
      params.push(designationId || null);
      paramIndex++;
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }
    
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_by = $${paramIndex}`);
    params.push(req.user.userId);
    paramIndex++;
    
    params.push(id);
    
    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, first_name, last_name, role, unit_id, designation_id, is_active, 
                 force_password_change, metadata, created_at, updated_at`,
      params
    );
    
    const updatedUser = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: id,
      changes: { old: existingUser, new: updatedUser },
      ...requestInfo
    });
    
    logActivity.user('UPDATE_USER', id, {
      updatedBy: req.user.userId,
      changes: updates.length,
      ...requestInfo
    });
    
    return res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete user (soft delete by setting is_active to false)
async function deleteUser(req, res) {
  const { id } = req.params;
  
  if (id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  try {
    const existingResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await query(
      'UPDATE users SET is_active = false, updated_by = $1 WHERE id = $2',
      [req.user.userId, id]
    );
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'user',
      entityId: id,
      changes: { old: existingResult.rows[0] },
      ...requestInfo
    });
    
    logActivity.user('DELETE_USER', id, {
      deletedBy: req.user.userId,
      email: existingResult.rows[0].email,
      ...requestInfo
    });
    
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Reset user password (admin only)
async function resetUserPassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  try {
    const existingResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const passwordHash = await hashPassword(newPassword);
    
    await query(
      'UPDATE users SET password_hash = $1, force_password_change = true, updated_by = $2 WHERE id = $3',
      [passwordHash, req.user.userId, id]
    );
    
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: id,
      ...requestInfo
    });
    
    logActivity.user('RESET_PASSWORD', id, {
      resetBy: req.user.userId,
      ...requestInfo
    });
    
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword
};
