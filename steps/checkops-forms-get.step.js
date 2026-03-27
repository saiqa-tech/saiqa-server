/**
 * CheckOps Forms - Get Single Form Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');

const config = {
    emits: [],
    name: 'CheckOpsFormsGet',
    type: 'api',
    path: '/api/checkops/forms/:formId',
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

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        const form = await checkopsWrapper.getForm(formId);

        if (!form) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        // Enrich UUID-string questions to full objects so the client can parse
        // FormResponseSchema without errors.
        await enrichFormQuestions(form, checkopsWrapper);

        return {
            status: 200,
            body: {
                success: true,
                data: form
            }
        };
    } catch (error) {
        console.error('CheckOps form retrieval failed:', error);

        if (error.message.includes('not found')) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Form retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
