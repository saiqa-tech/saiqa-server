/**
 * CheckOps Questions - List Questions Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsQuestionsList',
    type: 'api',
    path: '/api/checkops/questions',
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

        const { page = 1, limit = 20, questionType, isActive } = req.queryParams || {};

        const parsedPage = Math.max(1, parseInt(page));
        const parsedLimit = Math.min(parseInt(limit), 100);
        const offset = (parsedPage - 1) * parsedLimit;

        const listOptions = { limit: parsedLimit, offset };
        const countOptions = {};

        if (questionType) {
            listOptions.questionType = questionType;
            countOptions.questionType = questionType;
        }

        if (isActive !== undefined) {
            const isActiveBool = isActive === 'true';
            listOptions.isActive = isActiveBool;
            countOptions.isActive = isActiveBool;
        }

        const [questions, total] = await Promise.all([
            checkopsWrapper.getAllQuestions(listOptions),
            checkopsWrapper.getQuestionCount(countOptions),
        ]);

        return {
            status: 200,
            body: {
                success: true,
                data: questions,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit),
                },
            },
        };
    } catch (error) {
        console.error('CheckOps questions list failed:', error);
        return {
            status: 500,
            body: { error: 'Questions retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
