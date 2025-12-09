const { query } = require('../config/database');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UsersUpdatePreferences',
    type: 'api',
    path: '/api/users/me/preferences',
    method: 'PUT',
    middleware: [authenticate]
};

const handler = async (req, { logger }) => {
    const preferences = req.body;

    if (!preferences || typeof preferences !== 'object') {
        return { status: 400, body: { error: 'Preferences must be an object' } };
    }

    try {
        // Get current preferences for audit
        const currentUserResult = await query('SELECT preferences FROM users WHERE id = $1', [req.user.userId]);

        if (currentUserResult.rows.length === 0) {
            return { status: 404, body: { error: 'User not found' } };
        }

        const oldPreferences = currentUserResult.rows[0].preferences || {};

        const result = await query(
            `UPDATE users 
       SET preferences = $1, updated_by = $2
       WHERE id = $2
       RETURNING preferences`,
            [JSON.stringify(preferences), req.user.userId]
        );

        const updatedPreferences = result.rows[0].preferences;

        const requestInfo = getRequestInfo(req);
        await logAudit({
            userId: req.user.userId,
            action: 'UPDATE_PREFERENCES',
            entityType: 'user',
            entityId: req.user.userId,
            changes: {
                old: oldPreferences,
                new: updatedPreferences
            },
            ...requestInfo
        });

        logActivity.user('UPDATE_PREFERENCES', req.user.userId, {
            updatedBy: req.user.userId,
            changes: preferences,
            ...requestInfo
        });

        return { status: 200, body: { preferences: updatedPreferences } };
    } catch (error) {
        logger.error('Update user preferences error:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
};

module.exports = { config, handler };
