/**
 * CheckOps Forms - Get Form Statistics Endpoint
 *
 * Returns form data enriched with computed statistics:
 * submissionCount, questionCount, and lastSubmissionAt.
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsFormsStats',
    type: 'api',
    path: '/api/checkops/forms/:formId/stats',
    method: 'GET',
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return { status: 503, body: { error: 'CheckOps is not enabled' } };
        }

        const checkopsWrapper = getCheckOpsWrapper();
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        const { formId } = req.pathParams;

        if (!formId) {
            return { status: 400, body: { error: 'Form ID is required' } };
        }

        const form = await checkopsWrapper.getForm(formId);

        if (!form) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        const questionCount = Array.isArray(form.questions) ? form.questions.length : 0;

        // getSubmissionCount requires UUID (form.id) — SID would fail the DB query
        const submissionCount = await checkopsWrapper.getSubmissionCount({ formId: form.id });

        // Fetch the most recent submission to get lastSubmissionAt
        // Submission model uses `submittedAt`, not `createdAt`
        let lastSubmissionAt = null;
        if (submissionCount > 0) {
            const recentSubmissions = await checkopsWrapper.getSubmissionsByForm(form.id, {
                limit: 1,
                offset: 0,
            });
            if (Array.isArray(recentSubmissions) && recentSubmissions.length > 0) {
                lastSubmissionAt = recentSubmissions[0].submittedAt || null;
            }
        }

        return {
            status: 200,
            body: {
                success: true,
                data: {
                    ...form,
                    submissionCount,
                    questionCount,
                    lastSubmissionAt,
                },
            },
        };
    } catch (error) {
        console.error('CheckOps form stats failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        return {
            status: 500,
            body: { error: 'Form stats retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
