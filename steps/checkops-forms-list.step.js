/**
 * CheckOps Forms - List Forms Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsFormsList',
    type: 'api',
    path: '/api/checkops/forms',
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

        const { page = 1, limit = 20, search, isActive } = req.queryParams || {};

        const parsedPage = Math.max(1, parseInt(page));
        const parsedLimit = Math.min(parseInt(limit), 100);
        const offset = (parsedPage - 1) * parsedLimit;

        const listOptions = { limit: parsedLimit, offset };
        const countOptions = {};

        if (search) {
            listOptions.search = search;
        }

        if (isActive !== undefined) {
            const isActiveBool = isActive === 'true';
            listOptions.isActive = isActiveBool;
            countOptions.isActive = isActiveBool;
        }

        const [forms, total] = await Promise.all([
            checkopsWrapper.getAllForms(listOptions),
            checkopsWrapper.getFormCount(countOptions),
        ]);

        return {
            status: 200,
            body: {
                success: true,
                data: Array.isArray(forms) ? forms : (forms.forms || []),
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit),
                },
            }
        };
    } catch (error) {
        console.error('CheckOps forms list failed:', error);
        return {
            status: 500,
            body: {
                error: 'Forms retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
