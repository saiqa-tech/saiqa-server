/**
 * CheckOps Questions - Toggle Active Status Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsQuestionsToggleStatus',
    type: 'api',
    path: '/api/checkops/questions/:questionId/toggle-status',
    method: 'PATCH',
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

        // Toggle: deactivate if active, activate if inactive
        const updatedQuestion = question.isActive
            ? await checkopsWrapper.deactivateQuestion(question.id)
            : await checkopsWrapper.activateQuestion(question.id);

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            entityType: 'checkops_question',
            entityId: updatedQuestion.id,
            entitySid: updatedQuestion.sid,
            changes: { isActive: updatedQuestion.isActive },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(`✅ Question status toggled via API: ${updatedQuestion.sid} (${updatedQuestion.id}) isActive=${updatedQuestion.isActive} by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 200,
            body: { success: true, data: updatedQuestion },
        };
    } catch (error) {
        console.error('CheckOps question toggle status failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Question not found' } };
        }

        return {
            status: 500,
            body: { error: 'Question status toggle failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
