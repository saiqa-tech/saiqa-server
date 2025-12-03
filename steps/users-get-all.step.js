const { query } = require('../config/database');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
  emits: [],
  name: 'UsersGetAll',
  type: 'api',
  path: '/api/users',
  method: 'GET',
  middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    role = '', 
    unitId = '', 
    isActive = '' 
  } = req.queryParams || {};
  
  const offset = (page - 1) * limit;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    
    if (unitId) {
      whereConditions.push(`u.unit_id = $${paramIndex}`);
      params.push(unitId);
      paramIndex++;
    }
    
    if (isActive !== '') {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    params.push(limit, offset);
    
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
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return {
      status: 200,
      body: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  } catch (error) {
    logger.error('Get users error:', error);
    return { status: 500, body: { error: 'Internal server error' } };
  }
};

module.exports = { config, handler };
