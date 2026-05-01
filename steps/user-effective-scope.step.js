'use strict';

/**
 * GET /api/users/:userId/effective-scope
 *
 * Returns the list of stores this user can currently access, with source
 * attribution (home store vs tag match).
 *
 * Used by:
 *   - Admin UI "Tags & Scope" tab on the User detail page
 *   - Scope Explorer at /access-control
 *
 * Response:
 *   {
 *     "units": [
 *       { "id": "...", "name": "TDM Dubai", "code": "TDM_SSS_DUBAI", "source": "home" },
 *       { "id": "...", "name": "TDM Mall",  "code": "TDM_SSS_MALL",  "source": "tag_match" },
 *       ...
 *     ]
 *   }
 */

const { query } = require('../config/database');
const { getEffectiveScope } = require('../lib/scope-recompute');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UserEffectiveScope',
    type: 'api',
    path: '/api/users/:userId/effective-scope',
    method: 'GET',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { userId } = req.pathParams;

    try {
        // Verify user exists and get their home unit
        const userRes = await query(
            'SELECT id, unit_id FROM users WHERE id = $1 AND is_active = true',
            [userId]
        );
        if (userRes.rows.length === 0) {
            return { status: 404, body: { error: 'User not found' } };
        }

        const homeUnitId = userRes.rows[0].unit_id;

        // Calculate live scope
        const scopeUnitIds = await getEffectiveScope(userId);

        if (scopeUnitIds.length === 0) {
            return { status: 200, body: { units: [] } };
        }

        // Fetch unit details for all IDs in scope
        const unitsRes = await query(
            `SELECT id, name, code
       FROM units
       WHERE id = ANY($1)
       ORDER BY name`,
            [scopeUnitIds]
        );

        const units = unitsRes.rows.map((unit) => ({
            id: unit.id,
            name: unit.name,
            code: unit.code,
            source: unit.id === homeUnitId ? 'home' : 'tag_match'
        }));

        return { status: 200, body: { units } };
    } catch (error) {
        logger.error('User effective scope error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
