'use strict';

/**
 * PUT /api/units/:unitId/tags
 *
 * Full-replacement update of a unit's tag assignments.
 * The request body must carry the COMPLETE desired tag set.
 * All existing rows for this unit are deleted, then fresh rows are inserted.
 *
 * No cache to invalidate — subsequent getEffectiveScope() calls are live and
 * will reflect the new tags automatically.
 *
 * Request body:
 *   { "tagIds": ["uuid1", "uuid2", ...] }
 */

const { getClient } = require('../config/database');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UnitTagsUpdate',
    type: 'api',
    path: '/api/units/:unitId/tags',
    method: 'PUT',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { unitId } = req.pathParams;
    const { tagIds } = req.body || {};

    if (!Array.isArray(tagIds)) {
        return { status: 400, body: { error: 'tagIds must be an array' } };
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(unitId)) {
        return { status: 400, body: { error: 'unitId must be a valid UUID' } };
    }
    const invalidTagIds = tagIds.filter(id => !UUID_RE.test(id));
    if (invalidTagIds.length > 0) {
        return { status: 400, body: { error: 'All tagIds must be valid UUIDs' } };
    }
    const uniqueTagIds = [...new Set(tagIds)];

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Verify unit exists
        const unitRes = await client.query(
            'SELECT id FROM units WHERE id = $1',
            [unitId]
        );
        if (unitRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return { status: 404, body: { error: 'Unit not found' } };
        }

        // Validate all supplied tag IDs exist and are active
        if (uniqueTagIds.length > 0) {
            const validRes = await client.query(
                `SELECT id FROM tag_definitions
         WHERE id = ANY($1) AND is_active = true`,
                [uniqueTagIds]
            );
            if (validRes.rows.length !== uniqueTagIds.length) {
                await client.query('ROLLBACK');
                return { status: 400, body: { error: 'One or more tag IDs are invalid or inactive' } };
            }
        }

        // Delete all existing tag assignments for this unit
        await client.query(
            `DELETE FROM entity_tag_map WHERE entity_id = $1 AND entity_type = 'unit'`,
            [unitId]
        );

        // Insert new assignments
        if (uniqueTagIds.length > 0) {
            const assignedBy = req.user ? req.user.userId : null;
            const values = uniqueTagIds
                .map((_, i) => `($1, 'unit', $${i + 2}, $${uniqueTagIds.length + 2})`)
                .join(', ');
            await client.query(
                `INSERT INTO entity_tag_map (entity_id, entity_type, tag_id, assigned_by)
         VALUES ${values}`,
                [unitId, ...uniqueTagIds, assignedBy]
            );
        }

        await client.query('COMMIT');
        return { status: 200, body: { message: 'Tags updated' } };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Unit tags update error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    } finally {
        client.release();
    }
};

module.exports = { config, handler };
