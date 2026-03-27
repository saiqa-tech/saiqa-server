/**
 * CheckOps Questions - Delete Question Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsQuestionsDelete',
    type: 'api',
    path: '/api/checkops/questions/:questionId',
    method: 'DELETE',
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

        // Fetch question details before deletion for audit trail
        let questionText = 'Unknown';
        let questionSid = null;
        try {
            const question = await checkopsWrapper.getQuestion(questionId);
            questionText = question.questionText;
            questionSid = question.sid;
        } catch (e) {
            // If not found here, the delete call below will surface the error
        }

        const result = await checkopsWrapper.deleteQuestion(questionId);

        await logAudit({
            userId: req.user?.id,
            action: 'DELETE',
            entityType: 'checkops_question',
            entityId: questionId,
            entitySid: questionSid,
            changes: { questionText, sid: questionSid },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(`✅ Question deleted via API: ${questionSid || 'unknown'} (${questionId}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 200,
            body: { success: true, message: 'Question deleted successfully', data: result },
        };
    } catch (error) {
        console.error('CheckOps question deletion failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Question not found' } };
        }

        return {
            status: 500,
            body: { error: 'Question deletion failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
