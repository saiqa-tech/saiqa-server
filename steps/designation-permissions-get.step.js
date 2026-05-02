'use strict';

/**
 * GET /api/designations/:designationId/permissions
 *
 * Returns all capability rules configured for a specific designation.
 * One row per action (up to 6), showing whether it is allowed and the scope type.
 *
 * Response:
 *   {
 *     "permissions": [
 *       { "action": "SUBMIT_FORM",    "allowed": true,  "scopeType": "own"    },
 *       { "action": "VIEW_SUBMISSION","allowed": true,  "scopeType": "own"    },
 *       ...
 *     ]
 *   }
 */

const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// All 6 actions defined in the designation_permissions CHECK constraint.
// Any action without an explicit DB row is implicitly denied (deny-by-default).
// We materialize all 6 here so the admin UI always sees a complete matrix.
const ALL_ACTIONS = [
    'SUBMIT_FORM',
    'VIEW_SUBMISSION',
    'VIEW_FINDING',
    'UPDATE_FINDING',
    'VIEW_REPORT',
    'MANAGE_FORM',
];

const config = {
    emits: [],
    name: 'DesignationPermissionsGet',
    type: 'api',
    path: '/api/designations/:designationId/permissions',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, { logger }) => {
    const { designationId } = req.pathParams;

    try {
        // Verify designation exists
        const desigRes = await query(
            'SELECT id FROM designations WHERE id = $1',
            [designationId]
        );
        if (desigRes.rows.length === 0) {
            return { status: 404, body: { error: 'Designation not found' } };
        }

        const permsRes = await query(
            `SELECT action, allowed, scope_type
       FROM designation_permissions
       WHERE designation_id = $1
       ORDER BY action`,
            [designationId]
        );

        // Build a lookup map so we can materialize deny-by-default rows for
        // actions that have no explicit DB entry.
        const permsMap = new Map(permsRes.rows.map((row) => [row.action, row]));

        const permissions = ALL_ACTIONS.map((action) => {
            const row = permsMap.get(action);
            return row
                ? { action, allowed: row.allowed, scopeType: row.scope_type }
                : { action, allowed: false, scopeType: null };
        });

        return { status: 200, body: { permissions } };
    } catch (error) {
        logger.error('Designation permissions get error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
