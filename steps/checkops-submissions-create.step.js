/**
 * CheckOps Submissions - Create Submission Endpoint
 * POST /api/checkops/submissions
 *
 * Requires authentication (middleware: [authenticate]).
 * Without this, req.user is undefined and all scope checks would throw.
 *
 * Non-negotiable rule enforced here:
 *   Every submission targets the AUDITED STORE (targetUnitId).
 *   The submitter's home unit (users.unit_id) is NEVER the audited store.
 *   These are always two different logical concepts.
 *
 * Flow:
 *   1. Require and validate targetUnitId in the request body.
 *   2. Validate basic input (formId + submissionData).
 *   3. Look up user's designation.
 *   4. Check designation is allowed to submit forms.
 *   5. Compute the user's eligible stores for this specific form.
 *   6. Confirm targetUnitId is in the eligible set.
 *   7. Create the submission with targetUnitId and submitterUserId.
 *
 * Client-side validation (form-access endpoint + store picker UI) is a
 * usability layer — NOT a security layer. Only the server can be trusted.
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateSubmissionData } = require('../lib/checkops-validation');
const { createSubmissionWithQuestionIds } = require('../lib/checkops-question-id-mapper');
const { logAudit } = require('../utils/audit');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const {
    checkCapability,
    getUserScope,
    getFormApplicableUnits,
    computeEligibleUnits,
} = require('../lib/visibility-engine');

// Reuse the same UUID pattern that checkops-question-id-mapper uses.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsCreate',
    type: 'api',
    path: '/api/checkops/submissions',
    method: 'POST',
    middleware: [authenticate]  // ← required: sets req.user from JWT cookie
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const checkopsWrapper = getCheckOpsWrapper();

        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        const { formId, submissionData, targetUnitId } = req.body;
        const userId = req.user.userId;  // set by authenticate middleware

        // ── Step 1: Validate targetUnitId ──────────────────────────────────────
        // Must be present and must be a valid UUID.
        // We do this check FIRST so invalid input is rejected immediately,
        // before any database work.
        if (!targetUnitId || !UUID_REGEX.test(targetUnitId)) {
            return {
                status: 400,
                body: { error: 'targetUnitId is required and must be a valid UUID.' }
            };
        }

        // ── Step 2: Validate basic submission input ────────────────────────────
        const validationErrors = validateSubmissionData({
            formId,
            submissionData,
            submittedBy: userId,
        });

        if (validationErrors.length > 0) {
            return {
                status: 400,
                body: {
                    error: 'Validation failed',
                    details: validationErrors
                }
            };
        }

        // ── Step 3: Look up the user's designation ─────────────────────────────
        const userRes = await query(
            `SELECT u.designation_id,
                    d.code AS designation_code
             FROM users u
             LEFT JOIN designations d ON d.id = u.designation_id
             WHERE u.id = $1 AND u.is_active = true`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return {
                status: 403,
                body: { error: 'User not found or inactive.' }
            };
        }

        const designationId = userRes.rows[0].designation_id;
        const designationCode = userRes.rows[0].designation_code;
        const hasAdminAccess = req.user.role === 'admin' || designationCode === 'ADMIN';

        if (!designationId && !hasAdminAccess) {
            return {
                status: 403,
                body: { error: 'Your account has no job designation assigned. Contact an administrator.' }
            };
        }

        // ── Step 4: Check the designation can submit forms ─────────────────────
        // Deny-by-default: if no permission row exists, allowed = false.
        const capability = await checkCapability(designationId, 'SUBMIT_FORM', {
            userRole: req.user.role,
            designationCode,
        });
        if (!capability.allowed) {
            return {
                status: 403,
                body: { error: 'Your designation cannot submit forms.' }
            };
        }

        // ── Step 5: Compute eligible stores ───────────────────────────────────
        // eligibleUnitIds = user's scope ∩ form's applicable stores.
        // This is the same computation the form-access endpoint uses.
        const userScopeIds = await getUserScope(userId);
        const formApplicableIds = await getFormApplicableUnits(formId, designationId, {
            userRole: req.user.role,
            designationCode,
        });
        const eligibleUnitIds = computeEligibleUnits(userScopeIds, formApplicableIds);

        // ── Step 6: Confirm targetUnitId is in the eligible set ───────────────
        // This is the server-side enforcement of the scope rule.
        // The client's store picker already only shows eligible stores, but a
        // raw API caller could send any UUID. We reject unapproved targets here.
        if (!eligibleUnitIds.includes(targetUnitId)) {
            return {
                status: 403,
                body: { error: 'The selected store is not within your authorized scope for this form.' }
            };
        }

        // ── Step 7: Create the submission ─────────────────────────────────────
        const submission = await createSubmissionWithQuestionIds({
            formId,
            submissionData,
            metadata: {
                submittedAt: new Date().toISOString(),
                ipAddress: req.ip || req.headers?.['x-forwarded-for'],
                userAgent: req.headers?.['user-agent'],
            },
            targetUnitId,
            submitterUserId: userId,
        });

        // Audit trail
        await logAudit({
            userId,
            action: 'CREATE',
            entityType: 'checkops_submission',
            entityId: submission.id,
            entitySid: submission.sid,
            changes: {
                formId,
                formSid: submission.formSid,
                targetUnitId,
                dataKeys: Object.keys(submissionData),
            },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent'],
        });

        console.log(
            `✅ Submission created: ${submission.sid} (${submission.id}) ` +
            `for form ${submission.formSid} by user ${userId} targeting store ${targetUnitId}`
        );

        return {
            status: 201,
            body: {
                success: true,
                data: submission
            }
        };
    } catch (error) {
        console.error('CheckOps submission creation failed:', error);
        return {
            status: 500,
            body: {
                error: 'Submission creation failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };

