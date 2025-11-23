const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  name: 'UnitsCreate',
  type: 'api',
  path: '/api/units',
  method: 'POST',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const { 
    name, 
    code, 
    description, 
    parentUnitId, 
    metadata = {} 
  } = req.body;
  
  if (!name || !code) {
    return { status: 400, body: { error: 'Required fields: name, code' } };
  }
  
  try {
    // Check if code already exists
    const existingUnit = await query('SELECT id FROM units WHERE code = $1', [code]);
    
    if (existingUnit.rows.length > 0) {
      return { status: 400, body: { error: 'Unit code already exists' } };
    }
    
    // Validate parent unit exists if provided
    if (parentUnitId) {
      const parentUnit = await query('SELECT id FROM units WHERE id = $1', [parentUnitId]);
      if (parentUnit.rows.length === 0) {
        return { status: 400, body: { error: 'Parent unit not found' } };
      }
    }
    
    const result = await query(
      `INSERT INTO units (name, code, description, parent_unit_id, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, code, description, parent_unit_id, is_active, metadata, 
                 created_at, updated_at`,
      [name, code, description || null, parentUnitId || null, JSON.stringify(metadata), req.user.userId]
    );
    
    const newUnit = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      entityType: 'unit',
      entityId: newUnit.id,
      changes: { new: newUnit },
      ...requestInfo
    });
    
    logActivity.user('CREATE_UNIT', newUnit.id, {
      createdBy: req.user.userId,
      name: newUnit.name,
      code: newUnit.code,
      ...requestInfo
    });
    
    return { status: 201, body: { unit: newUnit } };
  } catch (error) {
    logger.error('Create unit error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
