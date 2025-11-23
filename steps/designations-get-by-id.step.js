const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
  name: 'DesignationsGetById',
  type: 'api',
  path: '/api/designations/:id',
  method: 'GET',
  middleware: [authenticate]
};

const handler = async (req, { logger }) => {
  const designationId = req.pathParams.id;
  
  try {
    const result = await query(
      `SELECT d.id, d.title, d.code, d.description, d.level, d.is_active,
              d.metadata, d.created_at, d.updated_at,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM designations d
       LEFT JOIN users creator ON d.created_by = creator.id
       LEFT JOIN users updater ON d.updated_by = updater.id
       WHERE d.id = $1`,
      [designationId]
    );
    
    if (result.rows.length === 0) {
      return { status: 404, body: { error: 'Designation not found' } };
    }
    
    return { status: 200, body: { designation: result.rows[0] } };
  } catch (error) {
    logger.error('Get designation by ID error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
