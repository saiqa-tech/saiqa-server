/**
 * CheckOps Submissions - List Submissions by Form Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsList',
    type: 'api',
    path: '/api/checkops/forms/:formId/submissions',
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

        const { formId } = req.pathParams;
        const { page = 1, limit = 20 } = req.queryParams || {};

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        const options = {
            limit: Math.min(parseInt(limit), 100),
            offset: (parseInt(page) - 1) * parseInt(limit)
        };

        const submissions = await checkopsWrapper.getSubmissionsByForm(formId, options);

        return {
            status: 200,
            body: {
                success: true,
                data: submissions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: Array.isArray(submissions) ? submissions.length : 0
                }
            }
        };
    } catch (error) {
        console.error('CheckOps submissions list failed:', error);
        return {
            status: 500,
            body: {
                error: 'Submissions retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
