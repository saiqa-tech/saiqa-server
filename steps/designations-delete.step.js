const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  name: 'DesignationsDelete',
  type: 'api',
  path: '/api/designations/:id',
  method: 'DELETE',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const designationId = req.pathParams.id;
  
  try {
    // Get designation data before deletion
    const designationResult = await query('SELECT * FROM designations WHERE id = $1', [designationId]);
    
    if (designationResult.rows.length === 0) {
      return { status: 404, body: { error: 'Designation not found' } };
    }
    
    const designation = designationResult.rows[0];
    
    // Check if designation has users assigned
    const assignedUsers = await query('SELECT COUNT(*) FROM users WHERE designation_id = $1', [designationId]);
    if (parseInt(assignedUsers.rows[0].count) > 0) {
      return { status: 400, body: { error: 'Cannot delete designation with assigned users' } };
    }
    
    // Soft delete: set is_active to false
    await query(
      'UPDATE designations SET is_active = false, updated_by = $1 WHERE id = $2',
      [req.user.userId, designationId]
    );
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'designation',
      entityId: designationId,
      changes: { old: designation },
      ...requestInfo
    });
    
    logActivity.user('DELETE_DESIGNATION', designationId, {
      deletedBy: req.user.userId,
      title: designation.title,
      code: designation.code,
      ...requestInfo
    });
    
    return { status: 200, body: { message: 'Designation deleted successfully' } };
  } catch (error) {
    logger.error('Delete designation error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
