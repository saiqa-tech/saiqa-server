/**
 * CheckOps Findings - Get Allowed Values Endpoint
 * 
 * Returns allowed values for finding fields (for UI dropdowns)
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getAllowedFindingValues } = require('../lib/checkops-finding-validator');

const config = {
    emits: [],
    name: 'CheckOpsFindingsAllowedValues',
    type: 'api',
    path: '/api/checkops/findings-allowed-values',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, ctx) => {
    try {
        // Check if CheckOps is enabled
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const allowedValues = await getAllowedFindingValues();

        return {
            status: 200,
            body: {
                success: true,
                data: allowedValues
            }
        };
    } catch (error) {
        console.error('Allowed values retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Allowed values retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
