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

        const permissions = permsRes.rows.map((row) => ({
            action: row.action,
            allowed: row.allowed,
            scopeType: row.scope_type
        }));

        return { status: 200, body: { permissions } };
    } catch (error) {
        logger.error('Designation permissions get error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
