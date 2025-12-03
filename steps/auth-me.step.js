const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
  emits: [],
  name: 'AuthGetCurrentUser',
  type: 'api',
  path: '/api/auth/me',
  method: 'GET',
  middleware: [authenticate]
};

const handler = async (req, { logger }) => {
  try {
    const result = await query(
      `SELECT u.*, 
              un.name as unit_name, 
              d.title as designation_title
       FROM users u
       LEFT JOIN units un ON u.unit_id = un.id
       LEFT JOIN designations d ON u.designation_id = d.id
       WHERE u.id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return { 
        status: 404, 
        body: { error: 'User not found' }
      };
    }

    const { password_hash, ...user } = result.rows[0];

    return {
      status: 200,
      body: {
        user,
        expiresAt: req.user.exp * 1000
      }
    };
  } catch (error) {
    logger.error('Get current user error:', error);
    return { 
      status: 500, 
      body: { error: 'Internal server error' }
    };
  }
};

module.exports = { config, handler };
