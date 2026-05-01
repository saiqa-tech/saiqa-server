'use strict';

/**
 * PUT /api/users/:userId/tags
 *
 * Full-replacement update of a user's personal tag assignments.
 * Same pattern as unit-tags-update but for the 'user' entity_type.
 *
 * No cache to invalidate — subsequent getEffectiveScope() calls are live.
 *
 * Request body:
 *   { "tagIds": ["uuid1", "uuid2", ...] }
 */

const { getClient } = require('../config/database');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UserTagsUpdate',
    type: 'api',
    path: '/api/users/:userId/tags',
    method: 'PUT',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { userId } = req.pathParams;
    const { tagIds } = req.body || {};

    if (!Array.isArray(tagIds)) {
        return { status: 400, body: { error: 'tagIds must be an array' } };
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Verify user exists
        const userRes = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return { status: 404, body: { error: 'User not found' } };
        }

        // Validate all supplied tag IDs exist and are active
        if (tagIds.length > 0) {
            const validRes = await client.query(
                `SELECT id FROM tag_definitions
         WHERE id = ANY($1) AND is_active = true`,
                [tagIds]
            );
            if (validRes.rows.length !== tagIds.length) {
                await client.query('ROLLBACK');
                return { status: 400, body: { error: 'One or more tag IDs are invalid or inactive' } };
            }
        }

        // Delete all existing personal tag assignments for this user
        await client.query(
            `DELETE FROM entity_tag_map WHERE entity_id = $1 AND entity_type = 'user'`,
            [userId]
        );

        // Insert new assignments
        if (tagIds.length > 0) {
            const assignedBy = req.user ? req.user.userId : null;
            const values = tagIds
                .map((_, i) => `($1, 'user', $${i + 2}, $${tagIds.length + 2})`)
                .join(', ');
            await client.query(
                `INSERT INTO entity_tag_map (entity_id, entity_type, tag_id, assigned_by)
         VALUES ${values}`,
                [userId, ...tagIds, assignedBy]
            );
        }

        await client.query('COMMIT');
        return { status: 200, body: { message: 'Tags updated' } };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('User tags update error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    } finally {
        client.release();
    }
};

module.exports = { config, handler };
