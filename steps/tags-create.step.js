'use strict';

/**
 * POST /api/tags
 *
 * Creates a new tag definition in the tag_definitions table.
 *
 * Request body:
 *   { "category": "Business_Unit", "value": "NewBrand", "label": "New Brand Name" }
 *
 * Rules:
 *   - category, value, label are all required.
 *   - (category, value) must be unique — enforced by DB UNIQUE constraint.
 *   - Only admins and managers may call this endpoint.
 *
 * Response (201):
 *   { "tag": { "id", "category", "value", "label", "isActive", "createdAt" } }
 */

const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { authenticate, managerOrAdmin } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'TagsCreate',
    type: 'api',
    path: '/api/tags',
    method: 'POST',
    middleware: [authenticate, managerOrAdmin]
};

const handler = async (req, { logger }) => {
    const { category, value, label } = req.body || {};

    if (!category || !value || !label) {
        return {
            status: 400,
            body: { error: 'category, value, and label are required' }
        };
    }

    try {
        const result = await query(
            `INSERT INTO tag_definitions (category, value, label)
             VALUES ($1, $2, $3)
             RETURNING id, category, value, label, is_active, created_at`,
            [category, value, label]
        );

        const row = result.rows[0];
        const newTag = {
            id: row.id,
            category: row.category,
            value: row.value,
            label: row.label,
            isActive: row.is_active,
            createdAt: row.created_at,
        };

        await logAudit({
            userId: req.user.userId,
            action: 'CREATE',
            entityType: 'tag_definition',
            entityId: newTag.id,
            changes: { new: newTag },
            ...getRequestInfo(req)
        });

        return { status: 201, body: { tag: newTag } };
    } catch (error) {
        // PostgreSQL unique constraint violation
        if (error.code === '23505') {
            return {
                status: 400,
                body: { error: 'A tag with this category and value already exists' }
            };
        }
        logger.error('Tags create error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
