'use strict';

/**
 * PATCH /api/tags/:tagId/toggle
 *
 * Flips the is_active flag on a tag definition:
 *   active   → inactive  (tag can no longer be assigned to new entities)
 *   inactive → active    (tag becomes assignable again)
 *
 * No request body required. The flip is always unconditional.
 *
 * Note: toggling a tag inactive does NOT delete existing assignments in
 * entity_tag_map or form_applicability_tag_map. Those records remain and
 * continue to affect scope/form-access logic until they are explicitly
 * removed. The admin should clean up assignments separately if needed.
 *
 * Response (200):
 *   { "tag": { "id", "category", "value", "label", "isActive", "createdAt" } }
 */

const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'TagsToggle',
    type: 'api',
    path: '/api/tags/:tagId/toggle',
    method: 'PATCH',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { tagId } = req.pathParams;

    try {
        // Look up the existing tag so we can (a) confirm it exists and
        // (b) capture the old is_active value for the audit log.
        const existing = await query(
            'SELECT id, is_active FROM tag_definitions WHERE id = $1',
            [tagId]
        );

        if (existing.rows.length === 0) {
            return { status: 404, body: { error: 'Tag not found' } };
        }

        const oldIsActive = existing.rows[0].is_active;

        const result = await query(
            `UPDATE tag_definitions
             SET is_active = NOT is_active
             WHERE id = $1
             RETURNING id, category, value, label, is_active, created_at`,
            [tagId]
        );

        const row = result.rows[0];
        const updatedTag = {
            id: row.id,
            category: row.category,
            value: row.value,
            label: row.label,
            isActive: row.is_active,
            createdAt: row.created_at,
        };

        await logAudit({
            userId: req.user.userId,
            action: 'UPDATE',
            entityType: 'tag_definition',
            entityId: tagId,
            changes: {
                old: { is_active: oldIsActive },
                new: { is_active: updatedTag.isActive }
            },
            ...getRequestInfo(req)
        });

        return { status: 200, body: { tag: updatedTag } };
    } catch (error) {
        logger.error('Tags toggle error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
