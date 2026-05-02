/**
 * CheckOps Forms - Update Form Endpoint
 */

require('dotenv').config();
const { authenticate, managerOrAdmin } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFormData } = require('../lib/checkops-validation');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { logAudit } = require('../utils/audit');
const { syncFormApplicability } = require('../lib/form-applicability-sync');
const { query } = require('../config/database');

/**
 * Extract per-form question overrides from an updates payload.
 *
 * Overrides are sparse objects attached to question entries by the client
 * (e.g. `{ questionId, questionText, ..., overrides: { required: true } }`).
 * CheckOps normalises question objects to UUID strings internally, so any
 * `overrides` field would be lost if passed through directly.
 *
 * This function:
 * 1. Collects overrides from each question entry into a map keyed by questionId.
 * 2. Stores the map in `updates.metadata.questionOverrides` so CheckOps persists it.
 *
 * On read, `checkops-form-enricher.js` re-attaches the overrides to each
 * enriched question from `form.metadata.questionOverrides`.
 *
 * @param {object} updates - Request body as received from the client.
 * @returns {object} Cloned updates with questionOverrides moved to metadata.
 */
function extractQuestionOverrides(updates) {
    if (!updates.questions || !Array.isArray(updates.questions)) {
        return updates;
    }

    const questionOverrides = {};
    for (const q of updates.questions) {
        const qId = q.questionId || q.id;
        if (qId && q.overrides && typeof q.overrides === 'object' && Object.keys(q.overrides).length > 0) {
            questionOverrides[qId] = q.overrides;
        }
    }

    // Only include metadata key when there are actual overrides.
    // Always sends metadata so CheckOps replaces the entire field, clearing stale
    // overrides for questions that were reset since the last save.
    return {
        ...updates,
        metadata: {
            ...(updates.metadata ?? {}),
            questionOverrides: Object.keys(questionOverrides).length > 0
                ? questionOverrides
                : undefined,
        },
    };
}

const config = {
    emits: [],
    name: 'CheckOpsFormsUpdate',
    type: 'api',
    path: '/api/checkops/forms/:formId',
    method: 'PUT',
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

        // Extract per-form question overrides before sending to CheckOps.
        // CheckOps normalises question objects to UUID strings — overrides would
        // be lost otherwise. We store them in metadata.questionOverrides so the
        // enricher can re-attach them on every subsequent read.
        const processedUpdates = extractQuestionOverrides(updates);

        // Strip the full `visibility` object out before sending to checkops.
        // checkops only knows `requireAll` (a plain boolean for the require_all column).
        // allowedDesignationIds and requiresTags belong to saiqa-server tables only.
        //
        // IMPORTANT: only include requireAll when the client explicitly sent a `visibility`
        // key.  If visibility is absent (e.g. a title-only update), we must NOT touch the
        // require_all column — omitting requireAll from the payload means updateById() skips
        // that column entirely.  Including it unconditionally would silently reset
        // require_all = false back to true on every title-only save.
        const hasVisibilityKey = Object.prototype.hasOwnProperty.call(processedUpdates, 'visibility');
        const { visibility: clientVisibility, ...checkopsUpdates } = processedUpdates;
        const normalizedVisibility =
            clientVisibility && typeof clientVisibility === 'object' ? clientVisibility : {};
        const updatedForm = await checkopsWrapper.updateForm(formId, {
            ...checkopsUpdates,
            ...(hasVisibilityKey && { requireAll: normalizedVisibility.require_all ?? true })
        });

        // Sync form applicability tables, but ONLY when the client explicitly
        // included a `visibility` key in the request body.
        // If visibility is absent (e.g. a title-only update), do NOT touch the
        // applicability tables at all — absence means "leave restrictions as-is",
        // not "clear all restrictions".
        if (hasVisibilityKey) {
            await syncFormApplicability(updatedForm.id, normalizedVisibility);
        }

        // Enrich UUID-string questions to full objects so the client can parse
        // FormResponseSchema without errors.
        await enrichFormQuestions(updatedForm, checkopsWrapper);

        // Attach the visibility object so the update response matches the GET response
        // shape. Without this the client receives requireAll (camelCase) at the top
        // level but no visibility object, and the FormBuilder loses visibility config
        // immediately after saving.
        const [designationRowsForVis, tagRowsForVis] = await Promise.all([
            query(
                'SELECT designation_id FROM form_applicability_designation_map WHERE form_id = $1',
                [updatedForm.id]
            ),
            query(
                `SELECT td.category, td.value
                 FROM form_applicability_tag_map fatm
                 JOIN tag_definitions td ON td.id = fatm.tag_id
                 WHERE fatm.form_id = $1`,
                [updatedForm.id]
            )
        ]);

        updatedForm.visibility = {
            require_all: updatedForm.requireAll ?? true,
            allowedDesignationIds: designationRowsForVis.rows.map((r) => r.designation_id),
            requiresTags: tagRowsForVis.rows.map((r) => ({ category: r.category, value: r.value }))
        };

        // Log audit trail
        await logAudit({
            userId: req.user?.userId,
            action: 'UPDATE',
            entityType: 'checkops_form',
            entityId: updatedForm.id,
            entitySid: updatedForm.sid,
            changes: updates,
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        // Enhanced logging
        console.log(`✅ Form updated via API: ${updatedForm.sid} (${updatedForm.id}) by user ${req.user?.userId || 'anonymous'}`);

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
