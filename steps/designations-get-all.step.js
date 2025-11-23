const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
  name: 'DesignationsGetAll',
  type: 'api',
  path: '/api/designations',
  method: 'GET',
  middleware: [authenticate]
};

const handler = async (req, { logger }) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    level = '', 
    isActive = '' 
  } = req.queryParams || {};
  
  const offset = (page - 1) * limit;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(d.title ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (level) {
      whereConditions.push(`d.level = $${paramIndex}`);
      params.push(parseInt(level));
      paramIndex++;
    }
    
    if (isActive !== '') {
      whereConditions.push(`d.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countResult = await query(
      `SELECT COUNT(*) FROM designations d ${whereClause}`,
      params
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    params.push(limit, offset);
    
    const result = await query(
      `SELECT d.id, d.title, d.code, d.description, d.level, d.is_active, 
              d.metadata, d.created_at, d.updated_at,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM designations d
       LEFT JOIN users creator ON d.created_by = creator.id
       LEFT JOIN users updater ON d.updated_by = updater.id
       ${whereClause}
       ORDER BY d.level ASC, d.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return {
      status: 200,
      body: {
        designations: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    logger.error('Get designations error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
