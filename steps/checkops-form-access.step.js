/**
 * CheckOps Forms - Form Access Check Endpoint
 *
 * GET /api/checkops/forms/:formId/access
 *
 * Answers: "Can I submit this form, and which stores can I submit it for?"
 *
 * The client calls this BEFORE opening a submission flow so it knows:
 *   - Whether the user can submit at all (canSubmit)
 *   - Whether a store picker is needed (requiresUnitSelection)
 *   - Which stores are eligible (eligibleUnits)
 *   - A human-readable reason when access is denied (reason)
 *
 * canView is always true on this endpoint: if the request reaches the handler
 * the user is authenticated and the form exists.  Only canSubmit varies.
 */

require('dotenv').config();
const { FormAccessResponseSchema } = require('@saiqa-tech/contracts');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const {
    checkCapability,
    getUserScope,
    getFormApplicableUnits,
    computeEligibleUnits,
    resolveSubmissionEntry
} = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFormAccess',
    type: 'api',
    path: '/api/checkops/forms/:formId/access',
    method: 'GET',
    middleware: [authenticate]
};

function buildFormAccessResponse(overrides = {}) {
    return FormAccessResponseSchema.parse({
        canView: true,
        canSubmit: false,
        requiresUnitSelection: false,
        defaultUnitId: null,
        defaultUnitName: null,
        eligibleUnits: [],
        reason: null,
        ...overrides,
    });
}

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const { formId } = req.pathParams;

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        // Verify the form actually exists before computing any visibility.
        // Without this check, a garbage formId flows into getFormApplicableUnits(),
        // which returns "all active units" for an unconfigured form and gives
        // back a misleading canSubmit result instead of a clear 404.
        const formExistsRes = await query(
            'SELECT 1 FROM forms WHERE id = $1',
            [formId]
        );
        if (formExistsRes.rows.length === 0) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        const userId = req.user.userId;

        // Step 1: Look up user's designation_id
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
                body: { error: 'User not found or inactive' }
            };
        }

        const designationId = userRes.rows[0].designation_id;
        const designationCode = userRes.rows[0].designation_code;
        const hasAdminAccess = req.user.role === 'admin' || designationCode === 'ADMIN';

        // Step 2: Check if user's designation is permitted to submit forms at all.
        // Deny-by-default: if no designation or no permission row, canSubmit = false.
        if (!designationId && !hasAdminAccess) {
            return {
                status: 200,
                body: buildFormAccessResponse({
                    reason: 'Your account has no job designation assigned. Contact an administrator.'
                })
            };
        }

        const capability = await checkCapability(designationId, 'SUBMIT_FORM', {
            userRole: req.user.role,
            designationCode,
        });
        if (!capability.allowed) {
            return {
                status: 200,
                body: buildFormAccessResponse({
                    reason: 'Your job designation is not permitted to submit forms.'
                })
            };
        }

        // Step 3: Get the set of stores the user can access.
        const userScopeIds = await getUserScope(userId);

        // Step 4: Get the set of stores this form applies to (for this designation).
        const formApplicableIds = await getFormApplicableUnits(formId, designationId, {
            userRole: req.user.role,
            designationCode,
        });

        // Step 5: Intersection — stores that are in BOTH the user's scope and form's scope.
        const eligibleUnitIds = computeEligibleUnits(userScopeIds, formApplicableIds);

        // Step 6: No eligible stores → cannot submit.
        if (eligibleUnitIds.length === 0) {
            return {
                status: 200,
                body: buildFormAccessResponse({
                    reason: 'None of the stores in your scope match this form\'s requirements.'
                })
            };
        }

        // Step 7: Fetch unit names and codes for eligible unit IDs.
        const unitsRes = await query(
            `SELECT id, name, code FROM units WHERE id = ANY($1::uuid[]) AND is_active = true`,
            [eligibleUnitIds]
        );
        const eligibleUnits = unitsRes.rows.map((r) => ({
            id: r.id,
            name: r.name,
            code: r.code
        }));

        // Step 8: Decide submission entry experience (no picker / picker needed).
        const entryDecision = resolveSubmissionEntry(eligibleUnits);

        // Step 9: Return full response.
        return {
            status: 200,
            body: buildFormAccessResponse({
                canView: true,
                canSubmit: entryDecision.canSubmit,
                requiresUnitSelection: entryDecision.requiresUnitSelection ?? false,
                defaultUnitId: entryDecision.defaultUnitId ?? null,
                defaultUnitName: entryDecision.defaultUnitId
                    ? (eligibleUnits.find((u) => u.id === entryDecision.defaultUnitId)?.name ?? null)
                    : null,
                eligibleUnits: entryDecision.eligibleUnits ?? eligibleUnits,
                reason: null
            })
        };
    } catch (error) {
        console.error('CheckOps form access check failed:', error);

        if (error.message && error.message.includes('not found')) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Form access check failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
