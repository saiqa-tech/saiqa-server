const { query } = require('../config/database');
const { hashPassword } = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate, adminOnly } = require('../middleware/auth');
const { generateSecurePassword } = require('../utils/password');

const config = {
  emits: [],
  name: 'UsersCreate',
  type: 'api',
  path: '/api/users',
  method: 'POST',
  middleware: [authenticate, adminOnly]
};

const handler = async (req, { logger }) => {
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

  if (!email || !firstName || !lastName || !role) {
    return { status: 400, body: { error: 'Required fields: email, firstName, lastName, role' } };
  }

  if (!['admin', 'manager', 'user'].includes(role)) {
    return { status: 400, body: { error: 'Invalid role' } };
  }

  // Generate password on server if not provided
  const userPassword = password || generateSecurePassword(12);

  if (userPassword.length < 8) {
    return { status: 400, body: { error: 'Password must be at least 8 characters' } };
  }

  try {
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return { status: 400, body: { error: 'Email already exists' } };
    }

    const passwordHash = await hashPassword(userPassword);

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

    // Return the generated password if it was auto-generated
    const responseBody = { user: newUser };
    if (!password) {
      responseBody.generatedPassword = userPassword;
    }

    return { status: 201, body: responseBody };
  } catch (error) {
    logger.error('Create user error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
