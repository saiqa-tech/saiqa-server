/**
 * CheckOps Questions - Get Single Question Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsQuestionsGet',
    type: 'api',
    path: '/api/checkops/questions/:questionId',
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

        return {
            status: 200,
            body: { success: true, data: question },
        };
    } catch (error) {
        console.error('CheckOps question retrieval failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Question not found' } };
        }

        return {
            status: 500,
            body: { error: 'Question retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
