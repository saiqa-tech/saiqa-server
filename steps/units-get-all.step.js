const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
  name: 'UnitsGetAll',
  type: 'api',
  path: '/api/units',
  method: 'GET',
  middleware: [authenticate]
};

const handler = async (req, { logger }) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    parentUnitId = '', 
    isActive = '' 
  } = req.queryParams || {};
  
  const offset = (page - 1) * limit;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.code ILIKE $${paramIndex} OR u.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (parentUnitId) {
      whereConditions.push(`u.parent_unit_id = $${paramIndex}`);
      params.push(parentUnitId);
      paramIndex++;
    }
    
    if (isActive !== '') {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countResult = await query(
      `SELECT COUNT(*) FROM units u ${whereClause}`,
      params
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    params.push(limit, offset);
    
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
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return {
      status: 200,
      body: {
        units: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    logger.error('Get units error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
