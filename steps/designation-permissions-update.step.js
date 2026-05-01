'use strict';

/**
 * PUT /api/designations/:designationId/permissions
 *
 * Full-replacement update of all capability rules for a designation.
 * The request body carries the COMPLETE desired set of permission rows.
 * All existing rows for this designation are deleted, then fresh rows are
 * inserted from the body.
 *
 * Does NOT trigger scope recomputation.  Permissions control what a
 * designation can DO, not which stores it can access.  Scope is determined
 * by tag matching, not by this table.
 *
 * Auth: admin only — only admins may change designation capabilities.
 *
 * Request body:
 *   {
 *     "permissions": [
 *       { "action": "SUBMIT_FORM",    "allowed": true,  "scopeType": "scoped" },
 *       { "action": "VIEW_SUBMISSION","allowed": true,  "scopeType": "scoped" },
 *       { "action": "VIEW_FINDING",   "allowed": false, "scopeType": "own"    }
 *     ]
 *   }
 */

const { getClient } = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const VALID_ACTIONS = new Set([
    'SUBMIT_FORM',
    'VIEW_SUBMISSION',
    'VIEW_FINDING',
    'UPDATE_FINDING',
    'VIEW_REPORT',
    'MANAGE_FORM'
]);

const VALID_SCOPE_TYPES = new Set(['own', 'scoped']);

const config = {
    emits: [],
    name: 'DesignationPermissionsUpdate',
    type: 'api',
    path: '/api/designations/:designationId/permissions',
    method: 'PUT',
    middleware: [authenticate, adminOnly]
};

const handler = async (req, { logger }) => {
    const { designationId } = req.pathParams;
    const { permissions } = req.body || {};

    if (!Array.isArray(permissions)) {
        return { status: 400, body: { error: 'permissions must be an array' } };
    }

    // Validate each permission entry before touching the database
    for (const perm of permissions) {
        if (!VALID_ACTIONS.has(perm.action)) {
            return {
                status: 400,
                body: { error: `Invalid action: ${perm.action}. Must be one of: ${[...VALID_ACTIONS].join(', ')}` }
            };
        }
        if (typeof perm.allowed !== 'boolean') {
            return { status: 400, body: { error: `allowed must be a boolean for action: ${perm.action}` } };
        }
        if (!VALID_SCOPE_TYPES.has(perm.scopeType)) {
            return {
                status: 400,
                body: { error: `Invalid scopeType: ${perm.scopeType}. Must be 'own' or 'scoped'` }
            };
        }
    }

    // Ensure no duplicate actions in the payload
    const actionsSeen = new Set();
    for (const perm of permissions) {
        if (actionsSeen.has(perm.action)) {
            return { status: 400, body: { error: `Duplicate action in payload: ${perm.action}` } };
        }
        actionsSeen.add(perm.action);
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Verify designation exists
        const desigRes = await client.query(
            'SELECT id FROM designations WHERE id = $1',
            [designationId]
        );
        if (desigRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return { status: 404, body: { error: 'Designation not found' } };
        }

        // Delete all existing permission rules for this designation
        await client.query(
            'DELETE FROM designation_permissions WHERE designation_id = $1',
            [designationId]
        );

        // Insert new rules
        if (permissions.length > 0) {
            const values = permissions
                .map((_, i) => {
                    const base = i * 4;
                    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
                })
                .join(', ');

            const params = permissions.flatMap((perm) => [
                designationId,
                perm.action,
                perm.allowed,
                perm.scopeType
            ]);

            await client.query(
                `INSERT INTO designation_permissions (designation_id, action, allowed, scope_type)
         VALUES ${values}`,
                params
            );
        }

        await client.query('COMMIT');
        return { status: 200, body: { message: 'Permissions updated' } };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Designation permissions update error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    } finally {
        client.release();
    }
};

module.exports = { config, handler };
