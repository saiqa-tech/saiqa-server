/**
 * CheckOps Findings - Get Statistics Endpoint
 * 
 * Provides aggregated statistics for findings by form
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsFindingsStats',
    type: 'api',
    path: '/api/checkops/findings/stats/:formId',
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

        const checkopsWrapper = getCheckOpsWrapper();

        // Ensure CheckOps is initialized
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        // Safely extract formId from params
        const formId = req.params?.formId;

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        const stats = await checkopsWrapper.getFindingsStats(formId);

        return {
            status: 200,
            body: {
                success: true,
                data: stats,
                formId
            }
        };
    } catch (error) {
        console.error('CheckOps findings stats failed:', error);

        // Handle not found errors
        if (error.message && error.message.includes('not found')) {
            return {
                status: 404,
                body: {
                    error: 'Form not found',
                    message: error.message
                }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Findings stats retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
