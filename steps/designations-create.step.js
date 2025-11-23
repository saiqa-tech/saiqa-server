const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  name: 'DesignationsCreate',
  type: 'api',
  path: '/api/designations',
  method: 'POST',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const { 
    title, 
    code, 
    description, 
    level, 
    metadata = {} 
  } = req.body;
  
  if (!title || !code) {
    return { status: 400, body: { error: 'Required fields: title, code' } };
  }
  
  try {
    // Check if code already exists
    const existingDesignation = await query('SELECT id FROM designations WHERE code = $1', [code]);
    
    if (existingDesignation.rows.length > 0) {
      return { status: 400, body: { error: 'Designation code already exists' } };
    }
    
    const result = await query(
      `INSERT INTO designations (title, code, description, level, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, code, description, level, is_active, metadata, 
                 created_at, updated_at`,
      [title, code, description || null, level || null, JSON.stringify(metadata), req.user.userId]
    );
    
    const newDesignation = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      entityType: 'designation',
      entityId: newDesignation.id,
      changes: { new: newDesignation },
      ...requestInfo
    });
    
    logActivity.user('CREATE_DESIGNATION', newDesignation.id, {
      createdBy: req.user.userId,
      title: newDesignation.title,
      code: newDesignation.code,
      ...requestInfo
    });
    
    return { status: 201, body: { designation: newDesignation } };
  } catch (error) {
    logger.error('Create designation error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
