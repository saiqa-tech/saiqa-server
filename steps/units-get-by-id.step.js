const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
  name: 'UnitsGetById',
  type: 'api',
  path: '/api/units/:id',
  method: 'GET',
  middleware: [authenticate]
};

const handler = async (req, { logger }) => {
  const unitId = req.pathParams.id;
  
  try {
    const result = await query(
      `SELECT u.id, u.name, u.code, u.description, u.parent_unit_id, u.is_active,
              u.metadata, u.created_at, u.updated_at,
              pu.name as parent_unit_name,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM units u
       LEFT JOIN units pu ON u.parent_unit_id = pu.id
       LEFT JOIN users creator ON u.created_by = creator.id
       LEFT JOIN users updater ON u.updated_by = updater.id
       WHERE u.id = $1`,
      [unitId]
    );
    
    if (result.rows.length === 0) {
      return { status: 404, body: { error: 'Unit not found' } };
    }
    
    return { status: 200, body: { unit: result.rows[0] } };
  } catch (error) {
    logger.error('Get unit by ID error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
