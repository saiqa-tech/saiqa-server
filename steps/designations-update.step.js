const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  name: 'DesignationsUpdate',
  type: 'api',
  path: '/api/designations/:id',
  method: 'PUT',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const designationId = req.pathParams.id;
  const { 
    title, 
    code, 
    description, 
    level, 
    isActive,
    metadata = {} 
  } = req.body;
  
  // Validate at least one field to update
  if (!title && !code && !description && level === undefined && 
      isActive === undefined && Object.keys(metadata).length === 0) {
    return { status: 400, body: { error: 'At least one field must be provided for update' } };
  }
  
  try {
    // Get current designation data
    const currentDesignationResult = await query('SELECT * FROM designations WHERE id = $1', [designationId]);
    
    if (currentDesignationResult.rows.length === 0) {
      return { status: 404, body: { error: 'Designation not found' } };
    }
    
    const currentDesignation = currentDesignationResult.rows[0];
    
    // Check if new code already exists (if code is being changed)
    if (code && code !== currentDesignation.code) {
      const existingDesignation = await query('SELECT id FROM designations WHERE code = $1 AND id != $2', [code, designationId]);
      if (existingDesignation.rows.length > 0) {
        return { status: 400, body: { error: 'Designation code already exists' } };
      }
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    
    if (code) {
      updates.push(`code = $${paramCount++}`);
      values.push(code);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description || null);
    }
    
    if (level !== undefined) {
      updates.push(`level = $${paramCount++}`);
      values.push(level || null);
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
    
    values.push(designationId);
    
    const result = await query(
      `UPDATE designations 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, title, code, description, level, is_active, metadata, 
                 created_at, updated_at`,
      values
    );
    
    const updatedDesignation = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'designation',
      entityId: updatedDesignation.id,
      changes: { 
        old: currentDesignation,
        new: updatedDesignation 
      },
      ...requestInfo
    });
    
    logActivity.user('UPDATE_DESIGNATION', updatedDesignation.id, {
      updatedBy: req.user.userId,
      changes: req.body,
      ...requestInfo
    });
    
    return { status: 200, body: { designation: updatedDesignation } };
  } catch (error) {
    logger.error('Update designation error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
