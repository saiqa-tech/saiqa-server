/**
 * CheckOps Config - Get Allowed Values Endpoint
 *
 * Returns allowed values for finding fields (for UI dropdowns).
 * Mirrors the existing /api/checkops/findings-allowed-values endpoint
 * at the path the client expects: /api/checkops/config/allowed-values.
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getAllowedFindingValues } = require('../lib/checkops-finding-validator');

const config = {
    emits: [],
    name: 'CheckOpsConfigAllowedValues',
    type: 'api',
    path: '/api/checkops/config/allowed-values',
    method: 'GET',
    middleware: [authenticate],
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return { status: 503, body: { error: 'CheckOps is not enabled' } };
        }

        const allowedValues = await getAllowedFindingValues();

        return {
            status: 200,
            body: {
                success: true,
                data: allowedValues,
            },
        };
    } catch (error) {
        console.error('Allowed values retrieval failed:', error);
        return {
            status: 500,
            body: { error: 'Allowed values retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
