'use strict';

/**
 * GET /api/users/:userId/tags
 *
 * Returns the tags currently assigned to a specific user.
 * Same structure as unit-tags-get but for the 'user' entity_type.
 */

const { query } = require('../config/database');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UserTagsGet',
    type: 'api',
    path: '/api/users/:userId/tags',
    method: 'GET',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { userId } = req.pathParams;

    try {
        // Verify user exists
        const userRes = await query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );
        if (userRes.rows.length === 0) {
            return { status: 404, body: { error: 'User not found' } };
        }

        const tagsRes = await query(
            `SELECT td.id, td.category, td.value, td.label, td.is_active,
              etm.assigned_at, etm.assigned_by
       FROM entity_tag_map etm
       JOIN tag_definitions td ON td.id = etm.tag_id
       WHERE etm.entity_id = $1 AND etm.entity_type = 'user'
       ORDER BY td.category, td.value`,
            [userId]
        );

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
        logger.error('User tags get error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
