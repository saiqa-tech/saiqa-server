const { query } = require('../config/database');
const { getClientIP, getUserAgent } = require('./request');

async function logAudit(data) {
  const {
    userId,
    action,
    entityType,
    entityId,
    entitySid = null,  // NEW: Human-readable ID (e.g., FORM-001, Q-001, SUB-001)
    changes = null,
    metadata = {},
    ipAddress = null,
    userAgent = null
  } = data;

  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, entity_sid, changes, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, action, entityType, entityId, entitySid, changes ? JSON.stringify(changes) : null, JSON.stringify(metadata), ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

function getRequestInfo(req) {
  return {
    ipAddress: getClientIP(req),
    userAgent: getUserAgent(req)
  };
}

module.exports = {
  logAudit,
  getRequestInfo
};
