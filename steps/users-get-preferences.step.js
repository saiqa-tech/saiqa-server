const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'UsersGetPreferences',
    type: 'api',
    path: '/api/users/me/preferences',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, { logger }) => {
    try {
        const result = await query(
            'SELECT preferences FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return {
                status: 404,
                body: { error: 'User not found' }
            };
        }

        return {
            status: 200,
            body: {
                preferences: result.rows[0].preferences || {}
            }
        };
    } catch (error) {
        logger.error('Get user preferences error:', error);
        return {
            status: 500,
            body: { error: 'Internal server error' }
        };
    }
};

module.exports = { config, handler };
