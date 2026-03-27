/**
 * CheckOps Forms - Delete Form Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsFormsDelete',
    type: 'api',
    path: '/api/checkops/forms/:formId',
    method: 'DELETE'
};

const handler = async (req, ctx) => {
    try {
        // Check if CheckOps is enabled
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const checkopsWrapper = getCheckOpsWrapper();

        // Ensure CheckOps is initialized
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        const { formId } = req.pathParams;

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        // Get form details before deletion for audit
        let formTitle = 'Unknown';
        let formSid = null;
        try {
            const form = await checkopsWrapper.getForm(formId);
            formTitle = form.title;
            formSid = form.sid;
        } catch (error) {
            // Form might not exist, continue with deletion attempt
        }

        const result = await checkopsWrapper.deleteForm(formId);

        // Log audit trail
        await logAudit({
            userId: req.user?.id,
            action: 'DELETE',
            entityType: 'checkops_form',
            entityId: formId,
            entitySid: formSid,  // NEW: Human-readable ID
            changes: { title: formTitle, sid: formSid },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        // Enhanced logging
        console.log(`✅ Form deleted via API: ${formSid || 'unknown'} (${formId}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 200,
            body: {
                success: true,
                message: 'Form deleted successfully',
                data: result
            }
        };
    } catch (error) {
        console.error('CheckOps form deletion failed:', error);

        if (error.message.includes('not found')) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Form deletion failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
