const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');

// Get all units with pagination and filters
async function getUnits(req, res) {
  const { page = 1, limit = 10, search = '', isActive = '', parentUnitId = '' } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.code ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (isActive !== '') {
      whereConditions.push(`u.is_active = $${paramIndex}`);
      params.push(isActive === 'true');
      paramIndex++;
    }
    
    if (parentUnitId) {
      if (parentUnitId === 'null') {
        whereConditions.push('u.parent_unit_id IS NULL');
      } else {
        whereConditions.push(`u.parent_unit_id = $${paramIndex}`);
        params.push(parentUnitId);
        paramIndex++;
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countResult = await query(`SELECT COUNT(*) FROM units u ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);
    
    params.push(limit, offset);
    
    const result = await query(
      `SELECT u.*, 
              parent.name as parent_unit_name,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM units u
       LEFT JOIN units parent ON u.parent_unit_id = parent.id
       LEFT JOIN users creator ON u.created_by = creator.id
       LEFT JOIN users updater ON u.updated_by = updater.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    return res.json({
      units: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get units error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get unit by ID
async function getUnitById(req, res) {
  const { id } = req.params;
  
  try {
    const result = await query(
      `SELECT u.*, 
              parent.name as parent_unit_name,
              creator.first_name as created_by_first_name, creator.last_name as created_by_last_name,
              updater.first_name as updated_by_first_name, updater.last_name as updated_by_last_name
       FROM units u
       LEFT JOIN units parent ON u.parent_unit_id = parent.id
       LEFT JOIN users creator ON u.created_by = creator.id
       LEFT JOIN users updater ON u.updated_by = updater.id
       WHERE u.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    return res.json({ unit: result.rows[0] });
  } catch (error) {
    console.error('Get unit by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Create unit
async function createUnit(req, res) {
  const { name, code, description, parentUnitId, metadata = {} } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ error: 'Name and code are required' });
  }
  
  try {
    const existingUnit = await query('SELECT id FROM units WHERE code = $1', [code]);
    
    if (existingUnit.rows.length > 0) {
      return res.status(400).json({ error: 'Code already exists' });
    }
    
    const result = await query(
      `INSERT INTO units (name, code, description, parent_unit_id, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, code, description || null, parentUnitId || null, JSON.stringify(metadata), req.user.userId]
    );
    
    const newUnit = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      entityType: 'unit',
      entityId: newUnit.id,
      changes: { new: newUnit },
      ...requestInfo
    });
    
    return res.status(201).json({ unit: newUnit });
  } catch (error) {
    console.error('Create unit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update unit
async function updateUnit(req, res) {
  const { id } = req.params;
  const { name, code, description, parentUnitId, isActive, metadata } = req.body;
  
  try {
    const existingResult = await query('SELECT * FROM units WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    const existingUnit = existingResult.rows[0];
    
    if (code && code !== existingUnit.code) {
      const codeCheck = await query('SELECT id FROM units WHERE code = $1 AND id != $2', [code, id]);
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Code already exists' });
      }
    }
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
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
    
    if (parentUnitId !== undefined) {
      updates.push(`parent_unit_id = $${paramIndex}`);
      params.push(parentUnitId || null);
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
      `UPDATE units SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    
    const updatedUnit = result.rows[0];
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'unit',
      entityId: id,
      changes: { old: existingUnit, new: updatedUnit },
      ...requestInfo
    });
    
    return res.json({ unit: updatedUnit });
  } catch (error) {
    console.error('Update unit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete unit
async function deleteUnit(req, res) {
  const { id } = req.params;
  
  try {
    const existingResult = await query('SELECT * FROM units WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    const childUnits = await query('SELECT COUNT(*) FROM units WHERE parent_unit_id = $1', [id]);
    if (parseInt(childUnits.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete unit with child units' });
    }
    
    await query('UPDATE units SET is_active = false, updated_by = $1 WHERE id = $2', [req.user.userId, id]);
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      entityType: 'unit',
      entityId: id,
      changes: { old: existingResult.rows[0] },
      ...requestInfo
    });
    
    return res.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    console.error('Delete unit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit
};
