/**
 * CheckOps Submissions - Get Single Submission Endpoint
 * GET /api/checkops/submissions/:id
 *
 * Returns one submission by UUID.
 *
 * Scope enforcement (same rules as the submissions list):
 *   filterType ALL   → any authorized viewer can read any submission
 *   filterType SELF  → submission's target_unit_id must match the user's
 *                      home unit, OR be NULL (legacy pre-Phase-3 row)
 *   filterType SCOPE → submission's target_unit_id must be in the user's
 *                      authorized unit list, OR be NULL (legacy pre-Phase-3 row)
 *
 * Legacy submissions (target_unit_id IS NULL) are visible to all authorized
 * viewers. The UI shows "—" instead of a store name for these rows.
 */

require('dotenv').config();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsGet',
    type: 'api',
    path: '/api/checkops/submissions/:id',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const { id } = req.pathParams;

        if (!id) {
            return {
                status: 400,
                body: { error: 'Submission ID is required' }
            };
        }

        // Build the reporting filter before touching any submission data.
        // If the user's designation doesn't have VIEW_SUBMISSION permission,
        // we return 403 immediately without leaking that the record exists.
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_SUBMISSION');

        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view submissions.' }
            };
        }

        // Fetch the submission row along with the store name and form title
        // so the client detail page can display them without extra round-trips.
        const submissionRes = await query(
            `SELECT
                s.id,
                s.sid,
                s.form_id,
                s.form_sid,
                s.submission_data,
                s.metadata,
                s.submitted_at,
                s.target_unit_id,
                s.submitter_user_id,
                u.name  AS target_unit_name,
                f.title AS form_title
             FROM submissions s
             JOIN forms      f ON f.id = s.form_id
             LEFT JOIN units u ON u.id = s.target_unit_id
             WHERE s.id = $1`,
            [id]
        );

        if (submissionRes.rows.length === 0) {
            return {
                status: 404,
                body: { error: 'Submission not found' }
            };
        }

        const row = submissionRes.rows[0];

        // Scope check — apply after the 404 so we don't reveal existence
        // to unauthorized callers.
        //
        // NULL target_unit_id means this is a legacy submission (created before
        // Phase 3).  Legacy rows are visible to any authorized viewer.
        if (filter.filterType === 'SELF') {
            if (row.target_unit_id !== null && row.target_unit_id !== filter.homeUnitId) {
                return {
                    status: 403,
                    body: { error: 'You do not have permission to view this submission.' }
                };
            }
        } else if (filter.filterType === 'SCOPE') {
            if (row.target_unit_id !== null && !filter.unitIds.includes(row.target_unit_id)) {
                return {
                    status: 403,
                    body: { error: 'You do not have permission to view this submission.' }
                };
            }
        }

        return {
            status: 200,
            body: {
                success: true,
                data: {
                    id: row.id,
                    sid: row.sid,
                    formId: row.form_id,
                    formSid: row.form_sid,
                    submissionData: row.submission_data,
                    metadata: row.metadata,
                    submittedAt: row.submitted_at,
                    targetUnitId: row.target_unit_id ?? null,
                    submitterUserId: row.submitter_user_id ?? null,
                    targetUnitName: row.target_unit_name ?? null,
                    formTitle: row.form_title,
                }
            }
        };
    } catch (error) {
        console.error('CheckOps submission retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Submission retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
