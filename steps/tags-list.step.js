'use strict';

/**
 * GET /api/tags
 *
 * Returns all tag definitions grouped by category (includes inactive tags).
 * Used by the admin UI to populate tag assignment controls.
 *
 * Response:
 *   {
 *     "tags": {
 *       "Business_Unit": [{ "id": "...", "value": "SSS", "label": "SSS Brand", "isActive": true }, ...],
 *       "Countries":     [...],
 *       ...
 *     }
 *   }
 */

const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'TagsList',
    type: 'api',
    path: '/api/tags',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, { logger }) => {
    try {
        const res = await query(
            `SELECT id, category, value, label, is_active
       FROM tag_definitions
       ORDER BY category, value`
        );

        // Group by category — include both active and inactive so the UI can show
        // archived tags in their collapsed "N archived" view.
        const grouped = {};
        for (const row of res.rows) {
            if (!grouped[row.category]) grouped[row.category] = [];
            grouped[row.category].push({
                id: row.id,
                value: row.value,
                label: row.label,
                isActive: row.is_active
            });
        }

        return { status: 200, body: { tags: grouped } };
    } catch (error) {
        logger.error('Tags list error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
