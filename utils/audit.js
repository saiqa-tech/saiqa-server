const { query } = require('../config/database');

async function logAudit(data) {
  const {
    userId,
    action,
    entityType,
    entityId,
    changes = null,
    metadata = {},
    ipAddress = null,
    userAgent = null
  } = data;
  
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, action, entityType, entityId, changes ? JSON.stringify(changes) : null, JSON.stringify(metadata), ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

function getRequestInfo(req) {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  };
}

module.exports = {
  logAudit,
  getRequestInfo
};
