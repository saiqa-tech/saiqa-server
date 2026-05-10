/**
 * CheckOps Forms - Create Form Endpoint (Post-Fix Implementation)
 */

require('dotenv').config();
const { authenticate, managerOrAdmin } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFormData } = require('../lib/checkops-validation');
const { createFormWithQuestionIds } = require('../lib/checkops-question-id-mapper');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { buildFormVisibility } = require('../lib/checkops-form-visibility');
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

        // Sync form applicability tables (designation + tag rules).
        // If this fails, delete the newly created form so we do not leave a form
        // that was intended to have restricted visibility in an open state.
        try {
            await syncFormApplicability(form.id, visibility ?? {});
        } catch (syncError) {
            try {
                await checkopsWrapper.deleteForm(form.id);
            } catch (deleteError) {
                console.error(
                    `[forms-create] Compensating delete failed for form ${form.id} after sync error:`,
                    deleteError
                );
            }
            throw syncError;
        }

        // Enrich UUID-string questions to full objects so the client can parse
        // FormResponseSchema without errors.
        await enrichFormQuestions(form, checkopsWrapper);

        // Attach the visibility object so the create response matches the GET/UPDATE
        // response shape. The values are taken directly from what we just persisted
        // rather than re-querying — no extra DB round-trips needed.
        const visConfig = visibility ?? {};
        form.visibility = buildFormVisibility({
            requireAll: visibility?.require_all,
            designationIds: Array.isArray(visConfig.allowedDesignationIds)
                ? visConfig.allowedDesignationIds
                : [],
            tagEntries: Array.isArray(visConfig.requiresTags)
                ? visConfig.requiresTags
                : [],
        });

        // Log audit trail
        await logAudit({
            userId: req.user?.userId,
            action: 'CREATE',
            entityType: 'checkops_form',
            entityId: form.id,
            entitySid: form.sid,
            changes: { title, sid: form.sid, questionCount: questions.length },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        // Enhanced logging
        console.log(`✅ Form created via API: ${form.sid} (${form.id}) by user ${req.user?.userId || 'anonymous'}`);

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
