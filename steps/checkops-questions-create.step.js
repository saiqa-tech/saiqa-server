/**
 * CheckOps Questions - Create Question Endpoint
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
    name: 'CheckOpsQuestionsCreate',
    type: 'api',
    path: '/api/checkops/questions',
    method: 'POST',
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

        const { questionText, questionType, options, validationRules, metadata } = req.body || {};

        if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
            return {
                status: 400,
                body: { error: 'questionText is required and must be a non-empty string' },
            };
        }

        if (!questionType || !VALID_QUESTION_TYPES.includes(questionType)) {
            return {
                status: 400,
                body: { error: `questionType must be one of: ${VALID_QUESTION_TYPES.join(', ')}` },
            };
        }

        const question = await checkopsWrapper.createQuestion({
            questionText,
            questionType,
            options,
            validationRules,
            metadata,
        });

        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            entityType: 'checkops_question',
            entityId: question.id,
            entitySid: question.sid,
            changes: { questionText, questionType },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(`✅ Question created via API: ${question.sid} (${question.id}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 201,
            body: { success: true, data: question },
        };
    } catch (error) {
        console.error('CheckOps question creation failed:', error);
        return {
            status: 500,
            body: { error: 'Question creation failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
