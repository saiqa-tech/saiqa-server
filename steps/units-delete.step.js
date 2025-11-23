const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  name: 'UnitsDelete',
  type: 'api',
  path: '/api/units/:id',
  method: 'DELETE',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const unitId = req.pathParams.id;
  
  try {
    // Get unit data before deletion
    const unitResult = await query('SELECT * FROM units WHERE id = $1', [unitId]);
    
    if (unitResult.rows.length === 0) {
      return { status: 404, body: { error: 'Unit not found' } };
    }
    
    const unit = unitResult.rows[0];
    
    // Check if unit has child units
    const childUnits = await query('SELECT COUNT(*) FROM units WHERE parent_unit_id = $1', [unitId]);
    if (parseInt(childUnits.rows[0].count) > 0) {
      return { status: 400, body: { error: 'Cannot delete unit with child units' } };
    }
    
    // Check if unit has users assigned
    const assignedUsers = await query('SELECT COUNT(*) FROM users WHERE unit_id = $1', [unitId]);
    if (parseInt(assignedUsers.rows[0].count) > 0) {
      return { status: 400, body: { error: 'Cannot delete unit with assigned users' } };
    }
    
    // Soft delete: set is_active to false
    await query(
      'UPDATE units SET is_active = false, updated_by = $1 WHERE id = $2',
      [req.user.userId, unitId]
    );
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'unit',
      entityId: unitId,
      changes: { old: unit },
      ...requestInfo
    });
    
    logActivity.user('DELETE_UNIT', unitId, {
      deletedBy: req.user.userId,
      name: unit.name,
      code: unit.code,
      ...requestInfo
    });
    
    return { status: 200, body: { message: 'Unit deleted successfully' } };
  } catch (error) {
    logger.error('Delete unit error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
