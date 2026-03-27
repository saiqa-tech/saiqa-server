/**
 * CheckOps Questions - Get Question Usage Endpoint
 *
 * Returns the question with computed usage statistics:
 * usedInForms (array of form SIDs) and totalUsage count.
 *
 * Note: CheckOps does not track usage automatically; this endpoint
 * computes it by scanning all forms for references to this question UUID.
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsQuestionsUsage',
    type: 'api',
    path: '/api/checkops/questions/:questionId/usage',
    method: 'GET',
    middleware: [authenticate],
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

        const { questionId } = req.pathParams;

        if (!questionId) {
            return { status: 400, body: { error: 'Question ID is required' } };
        }

        const question = await checkopsWrapper.getQuestion(questionId);

        if (!question) {
            return { status: 404, body: { error: 'Question not found' } };
        }

        // Scan all forms to find those referencing this question UUID.
        // form.questions is an array of UUID strings (v4.0.0+).
        const allForms = await checkopsWrapper.getAllForms({ limit: 1000 });
        const forms = Array.isArray(allForms) ? allForms : [];

        const usedInForms = forms
            .filter(
                (form) =>
                    Array.isArray(form.questions) &&
                    form.questions.includes(question.id),
            )
            .map((form) => form.sid);

        return {
            status: 200,
            body: {
                success: true,
                data: {
                    ...question,
                    usedInForms,
                    totalUsage: usedInForms.length,
                    usageCount: usedInForms.length,
                },
            },
        };
    } catch (error) {
        console.error('CheckOps question usage retrieval failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Question not found' } };
        }

        return {
            status: 500,
            body: { error: 'Question usage retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
