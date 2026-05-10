'use strict';

/**
 * GET /api/units/:unitId/tags
 *
 * Returns the tags currently assigned to a specific unit (store).
 * Response includes full tag details grouped by category.
 */

const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UnitTagsGet',
    type: 'api',
    path: '/api/units/:unitId/tags',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, { logger }) => {
    const { unitId } = req.pathParams;

    try {
        // Verify unit exists
        const unitRes = await query('SELECT id FROM units WHERE id = $1', [unitId]);
        if (unitRes.rows.length === 0) {
            return { status: 404, body: { error: 'Unit not found' } };
        }

        const tagsRes = await query(
            `SELECT td.id, td.category, td.value, td.label, td.is_active,
              etm.assigned_at, etm.assigned_by
       FROM entity_tag_map etm
       JOIN tag_definitions td ON td.id = etm.tag_id
       WHERE etm.entity_id = $1 AND etm.entity_type = 'unit'
       ORDER BY td.category, td.value`,
            [unitId]
        );

        // Group by category for the UI
        const grouped = {};
        for (const row of tagsRes.rows) {
            if (!grouped[row.category]) grouped[row.category] = [];
            grouped[row.category].push({
                id: row.id,
                value: row.value,
                label: row.label,
                isActive: row.is_active,
                assignedAt: row.assigned_at,
                assignedBy: row.assigned_by
            });
        }

        return { status: 200, body: { tags: grouped } };
    } catch (error) {
        logger.error('Unit tags get error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
