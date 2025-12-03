const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  emits: [],
  name: 'UnitsUpdate',
  type: 'api',
  path: '/api/units/:id',
  method: 'PUT',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const unitId = req.pathParams.id;
  const { 
    name, 
    code, 
    description, 
    parentUnitId, 
    isActive,
    metadata = {} 
  } = req.body;
  
  // Validate at least one field to update
  if (!name && !code && !description && parentUnitId === undefined && 
      isActive === undefined && Object.keys(metadata).length === 0) {
    return { status: 400, body: { error: 'At least one field must be provided for update' } };
  }
  
  try {
    // Get current unit data
    const currentUnitResult = await query('SELECT * FROM units WHERE id = $1', [unitId]);
    
    if (currentUnitResult.rows.length === 0) {
      return { status: 404, body: { error: 'Unit not found' } };
    }
    
    const currentUnit = currentUnitResult.rows[0];
    
    // Check if new code already exists (if code is being changed)
    if (code && code !== currentUnit.code) {
      const existingUnit = await query('SELECT id FROM units WHERE code = $1 AND id != $2', [code, unitId]);
      if (existingUnit.rows.length > 0) {
        return { status: 400, body: { error: 'Unit code already exists' } };
      }
    }
    
    // Validate parent unit exists if provided and prevent circular reference
    if (parentUnitId !== undefined && parentUnitId !== null) {
      if (parentUnitId === unitId) {
        return { status: 400, body: { error: 'Unit cannot be its own parent' } };
      }
      
      const parentUnit = await query('SELECT id FROM units WHERE id = $1', [parentUnitId]);
      if (parentUnit.rows.length === 0) {
        return { status: 400, body: { error: 'Parent unit not found' } };
      }
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (code) {
      updates.push(`code = $${paramCount++}`);
      values.push(code);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description || null);
    }
    
    if (parentUnitId !== undefined) {
      updates.push(`parent_unit_id = $${paramCount++}`);
      values.push(parentUnitId || null);
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
    
    values.push(unitId);
    
    const result = await query(
      `UPDATE units 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name, code, description, parent_unit_id, is_active, metadata, 
                 created_at, updated_at`,
      values
    );
    
    const updatedUnit = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'unit',
      entityId: updatedUnit.id,
      changes: { 
        old: currentUnit,
        new: updatedUnit 
      },
      ...requestInfo
    });
    
    logActivity.user('UPDATE_UNIT', updatedUnit.id, {
      updatedBy: req.user.userId,
      changes: req.body,
      ...requestInfo
    });
    
    return { status: 200, body: { unit: updatedUnit } };
  } catch (error) {
    logger.error('Update unit error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
