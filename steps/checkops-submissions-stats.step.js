/**
 * CheckOps Submissions - Get Statistics Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsStats',
    type: 'api',
    path: '/api/checkops/submissions/stats',
    method: 'GET'
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

        const { formId } = req.queryParams || {};

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        const stats = await checkopsWrapper.getSubmissionStats(formId);

        return {
            status: 200,
            body: {
                success: true,
                data: stats
            }
        };
    } catch (error) {
        console.error('CheckOps stats retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Stats retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
