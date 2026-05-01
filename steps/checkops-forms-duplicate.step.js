/**
 * CheckOps Forms - Duplicate Form Endpoint
 *
 * Creates a copy of an existing form referencing the same question UUIDs.
 * The new form gets title "Copy of <original title>" and a new SID.
 */

require('dotenv').config();
const { authenticate, managerOrAdmin } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsFormsDuplicate',
    type: 'api',
    path: '/api/checkops/forms/:formId/duplicate',
    method: 'POST',
    middleware: [authenticate, managerOrAdmin],
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

        const sourceForm = await checkopsWrapper.getForm(formId);

        if (!sourceForm) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        // Reuse the existing question UUIDs — no new questions are created
        const duplicatedForm = await checkopsWrapper.createForm({
            title: `Copy of ${sourceForm.title}`,
            description: sourceForm.description || '',
            questions: sourceForm.questions || [],
            metadata: {},
        });

        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            entityType: 'checkops_form',
            entityId: duplicatedForm.id,
            entitySid: duplicatedForm.sid,
            changes: { title: duplicatedForm.title, duplicatedFrom: sourceForm.sid },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(`✅ Form duplicated via API: ${duplicatedForm.sid} (${duplicatedForm.id}) from ${sourceForm.sid} by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 201,
            body: { success: true, data: duplicatedForm },
        };
    } catch (error) {
        console.error('CheckOps form duplication failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        return {
            status: 500,
            body: { error: 'Form duplication failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
