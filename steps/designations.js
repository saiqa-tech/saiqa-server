const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');

// Get all designations with pagination and filters
async function getDesignations(req, res) {
  const { page = 1, limit = 10, search = '', isActive = '' } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(d.title ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (isActive !== '') {
      whereConditions.push(`d.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countResult = await query(`SELECT COUNT(*) FROM designations d ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);
    
    params.push(limit, offset);
    
    const result = await query(
      `SELECT d.*, 
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
    
    return res.json({
      designations: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get designations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get designation by ID
async function getDesignationById(req, res) {
  const { id } = req.params;
  
  try {
    const result = await query(
      `SELECT d.*, 
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM designations d
       LEFT JOIN users creator ON d.created_by = creator.id
       LEFT JOIN users updater ON d.updated_by = updater.id
       WHERE d.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Designation not found' });
    }
    
    return res.json({ designation: result.rows[0] });
  } catch (error) {
    console.error('Get designation by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Create designation
async function createDesignation(req, res) {
  const { title, code, description, level, metadata = {} } = req.body;
  
  if (!title || !code) {
    return res.status(400).json({ error: 'Title and code are required' });
  }
  
  try {
    const existingDesignation = await query('SELECT id FROM designations WHERE code = $1', [code]);
    
    if (existingDesignation.rows.length > 0) {
      return res.status(400).json({ error: 'Code already exists' });
    }
    
    const result = await query(
      `INSERT INTO designations (title, code, description, level, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, code, description || null, level || null, JSON.stringify(metadata), req.user.userId]
    );
    
    const newDesignation = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      entityType: 'designation',
      entityId: newDesignation.id,
      changes: { new: newDesignation },
      ...requestInfo
    });
    
    return res.status(201).json({ designation: newDesignation });
  } catch (error) {
    console.error('Create designation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update designation
async function updateDesignation(req, res) {
  const { id } = req.params;
  const { title, code, description, level, isActive, metadata } = req.body;
  
  try {
    const existingResult = await query('SELECT * FROM designations WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Designation not found' });
    }
    
    const existingDesignation = existingResult.rows[0];
    
    if (code && code !== existingDesignation.code) {
      const codeCheck = await query('SELECT id FROM designations WHERE code = $1 AND id != $2', [code, id]);
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Code already exists' });
      }
    }
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
    }
    
    if (code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      params.push(code);
      paramIndex++;
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description || null);
      paramIndex++;
    }
    
    if (level !== undefined) {
      updates.push(`level = $${paramIndex}`);
      params.push(level || null);
      paramIndex++;
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }
    
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_by = $${paramIndex}`);
    params.push(req.user.userId);
    paramIndex++;
    
    params.push(id);
    
    const result = await query(
      `UPDATE designations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    
    const updatedDesignation = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'designation',
      entityId: id,
      changes: { old: existingDesignation, new: updatedDesignation },
      ...requestInfo
    });
    
    return res.json({ designation: updatedDesignation });
  } catch (error) {
    console.error('Update designation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete designation
async function deleteDesignation(req, res) {
  const { id } = req.params;
  
  try {
    const existingResult = await query('SELECT * FROM designations WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Designation not found' });
    }
    
    await query('UPDATE designations SET is_active = false, updated_by = $1 WHERE id = $2', [req.user.userId, id]);
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'designation',
      entityId: id,
      changes: { old: existingResult.rows[0] },
      ...requestInfo
    });
    
    return res.json({ message: 'Designation deleted successfully' });
  } catch (error) {
    console.error('Delete designation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation
};
