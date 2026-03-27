/**
 * CheckOps Forms - Update Form Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFormData } = require('../lib/checkops-validation');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsFormsUpdate',
    type: 'api',
    path: '/api/checkops/forms/:formId',
    method: 'PUT'
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
        const updates = req.body;

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        // Validate updates if questions are provided
        if (updates.questions) {
            const validationErrors = validateFormData(updates);
            if (validationErrors.length > 0) {
                return {
                    status: 400,
                    body: {
                        error: 'Validation failed',
                        details: validationErrors
                    }
                };
            }
        }

        const updatedForm = await checkopsWrapper.updateForm(formId, updates);

        // Enrich UUID-string questions to full objects so the client can parse
        // FormResponseSchema without errors.
        await enrichFormQuestions(updatedForm, checkopsWrapper);

        // Log audit trail
        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            entityType: 'checkops_form',
            entityId: updatedForm.id,
            entitySid: updatedForm.sid,  // NEW: Human-readable ID
            changes: updates,
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        // Enhanced logging
        console.log(`✅ Form updated via API: ${updatedForm.sid} (${updatedForm.id}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 200,
            body: {
                success: true,
                data: updatedForm
            }
        };
    } catch (error) {
        console.error('CheckOps form update failed:', error);

        if (error.message.includes('not found')) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Form update failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
