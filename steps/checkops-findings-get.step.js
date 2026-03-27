/**
 * CheckOps Findings - Get Single Finding Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsFindingsGet',
    type: 'api',
    path: '/api/checkops/findings/:id',
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

        // Safely extract id from params
        const id = req.params?.id;

        if (!id) {
            return {
                status: 400,
                body: { error: 'Finding ID is required' }
            };
        }

        // Get finding by ID (supports both UUID and SID)
        const finding = await checkopsWrapper.getFinding(id);

        return {
            status: 200,
            body: {
                success: true,
                data: finding
            }
        };
    } catch (error) {
        console.error('CheckOps finding retrieval failed:', error);

        // Handle not found errors
        if (error.message && error.message.includes('not found')) {
            return {
                status: 404,
                body: {
                    error: 'Finding not found',
                    message: error.message
                }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Finding retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
