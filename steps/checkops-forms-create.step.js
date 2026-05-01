/**
 * CheckOps Forms - Create Form Endpoint (Post-Fix Implementation)
 */

require('dotenv').config();
const { authenticate, managerOrAdmin } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFormData } = require('../lib/checkops-validation');
const { createFormWithQuestionIds } = require('../lib/checkops-question-id-mapper');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { logAudit } = require('../utils/audit');
const { syncFormApplicability } = require('../lib/form-applicability-sync');

const config = {
    emits: [],
    name: 'CheckOpsFormsCreate',
    type: 'api',
    path: '/api/checkops/forms',
    method: 'POST',
    middleware: [authenticate, managerOrAdmin]
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

        // Validate request body
        const { title, description, questions, metadata, visibility } = req.body;

        const validationErrors = validateFormData({ title, description, questions, metadata });
        if (validationErrors.length > 0) {
            return {
                status: 400,
                body: {
                    error: 'Validation failed',
                    details: validationErrors
                }
            };
        }

        // Create form using proper CheckOps workflow (post-fix)
        // Pass requireAll (boolean) directly to checkops — the boolean is the only
        // thing stored in the forms table.  The full visibilityConfig (with
        // allowedDesignationIds + requiresTags) is written to saiqa-server tables
        // by syncFormApplicability below.
        const form = await createFormWithQuestionIds({
            title,
            description: description || '',
            questions,
            metadata: metadata || {},
            requireAll: visibility?.require_all ?? true
        });

        // Sync form applicability tables (designation + tag rules)
        await syncFormApplicability(form.id, visibility ?? {});

        // Enrich UUID-string questions to full objects so the client can parse
        // FormResponseSchema without errors.
        await enrichFormQuestions(form, checkopsWrapper);

        // Log audit trail
        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            entityType: 'checkops_form',
            entityId: form.id,
            entitySid: form.sid,  // NEW: Human-readable ID
            changes: { title, sid: form.sid, questionCount: questions.length },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        // Enhanced logging
        console.log(`✅ Form created via API: ${form.sid} (${form.id}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 201,
            body: {
                success: true,
                data: form
            }
        };
    } catch (error) {
        console.error('CheckOps form creation failed:', error);
        return {
            status: 500,
            body: {
                error: 'Form creation failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
