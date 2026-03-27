/**
 * CheckOps Questions - Update Question Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const VALID_QUESTION_TYPES = [
    'text', 'textarea', 'number', 'email', 'phone', 'date', 'time',
    'datetime', 'select', 'multiselect', 'radio', 'checkbox',
    'boolean', 'file', 'rating',
];

const config = {
    emits: [],
    name: 'CheckOpsQuestionsUpdate',
    type: 'api',
    path: '/api/checkops/questions/:questionId',
    method: 'PUT',
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
        const updates = req.body || {};

        if (!questionId) {
            return { status: 400, body: { error: 'Question ID is required' } };
        }

        if (Object.keys(updates).length === 0) {
            return {
                status: 400,
                body: { error: 'At least one field must be provided for update' },
            };
        }

        if (updates.questionType && !VALID_QUESTION_TYPES.includes(updates.questionType)) {
            return {
                status: 400,
                body: { error: `questionType must be one of: ${VALID_QUESTION_TYPES.join(', ')}` },
            };
        }

        const updatedQuestion = await checkopsWrapper.updateQuestion(questionId, updates);

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            entityType: 'checkops_question',
            entityId: updatedQuestion.id,
            entitySid: updatedQuestion.sid,
            changes: updates,
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(`✅ Question updated via API: ${updatedQuestion.sid} (${updatedQuestion.id}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 200,
            body: { success: true, data: updatedQuestion },
        };
    } catch (error) {
        console.error('CheckOps question update failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Question not found' } };
        }

        return {
            status: 500,
            body: { error: 'Question update failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
