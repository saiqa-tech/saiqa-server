const { query } = require('../config/database');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  emits: [],
  name: 'UsersGetById',
  type: 'api',
  path: '/api/users/:id',
  method: 'GET',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const { id } = req.pathParams;
  
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
      return { status: 404, body: { error: 'User not found' } };
    }
    
    return { status: 200, body: { user: result.rows[0] } };
  } catch (error) {
    logger.error('Get user by ID error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
