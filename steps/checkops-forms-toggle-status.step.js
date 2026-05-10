/**
 * CheckOps Forms - Toggle Active Status Endpoint
 */

require('dotenv').config();
const { authenticate, managerOrAdmin } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsFormsToggleStatus',
    type: 'api',
    path: '/api/checkops/forms/:formId/toggle-status',
    method: 'PATCH',
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

        const form = await checkopsWrapper.getForm(formId);

        if (!form) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        // Toggle: deactivate if active, activate if inactive
        const updatedForm = form.isActive
            ? await checkopsWrapper.deactivateForm(form.id)
            : await checkopsWrapper.activateForm(form.id);

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            entityType: 'checkops_form',
            entityId: updatedForm.id,
            entitySid: updatedForm.sid,
            changes: { isActive: updatedForm.isActive },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(`✅ Form status toggled via API: ${updatedForm.sid} (${updatedForm.id}) isActive=${updatedForm.isActive} by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 200,
            body: { success: true, data: updatedForm },
        };
    } catch (error) {
        console.error('CheckOps form toggle status failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        return {
            status: 500,
            body: { error: 'Form status toggle failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
