'use strict';

/**
 * PUT /api/tags/:tagId
 *
 * Updates the label of an existing tag definition.
 *
 * WHY label only — not value or category:
 *   value and category are referenced by entity_tag_map and
 *   form_applicability_tag_map. Changing them would silently break all
 *   existing assignments. Only label (the display name shown in the UI)
 *   is safe to update after creation.
 *
 * Request body:
 *   { "label": "Updated Display Name" }
 *
 * Response (200):
 *   { "tag": { "id", "category", "value", "label", "isActive", "createdAt" } }
 */

const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'TagsUpdate',
    type: 'api',
    path: '/api/tags/:tagId',
    method: 'PUT',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { tagId } = req.pathParams;
    const { label } = req.body || {};

    if (!label) {
        return {
            status: 400,
            body: { error: 'label is required' }
        };
    }

    try {
        // Look up the existing tag so we can (a) confirm it exists and
        // (b) capture the old label for the audit log.
        const existing = await query(
            'SELECT id, label FROM tag_definitions WHERE id = $1',
            [tagId]
        );

        if (existing.rows.length === 0) {
            return { status: 404, body: { error: 'Tag not found' } };
        }

        const oldLabel = existing.rows[0].label;

        const result = await query(
            `UPDATE tag_definitions
             SET label = $1
             WHERE id = $2
             RETURNING id, category, value, label, is_active, created_at`,
            [label, tagId]
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
            changes: { old: { label: oldLabel }, new: { label } },
            ...getRequestInfo(req)
        });

        return { status: 200, body: { tag: updatedTag } };
    } catch (error) {
        logger.error('Tags update error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
