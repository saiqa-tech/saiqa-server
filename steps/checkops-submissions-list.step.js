/**
 * CheckOps Submissions - List Submissions Endpoint
 *
 * Phase 4: returns only submissions the requesting user is authorised to see,
 * filtered by formId and scoped to stores within the user's authorised scope
 * (target_unit_id).
 *
 * Uses a direct SQL query instead of the checkops wrapper so that the scope
 * WHERE clause can be injected.  Both saiqa-server and checkops share the
 * same PostgreSQL database.
 *
 * Path changed from /api/checkops/forms/:formId/submissions (path param) to
 * /api/checkops/submissions?formId=xxx (query param) to match the client.
 */

require('dotenv').config();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsList',
    type: 'api',
    path: '/api/checkops/submissions',
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

        const { formId, page = 1, limit = 20 } = req.queryParams || {};

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        const parsedPage = Math.max(1, parseInt(page));
        const parsedLimit = Math.min(parseInt(limit), 100);
        const offset = (parsedPage - 1) * parsedLimit;

        // Step 1 — Build the reporting filter for this user
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_SUBMISSION');

        // Step 2 — 403 if not allowed
        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view submissions.' }
            };
        }

        // Step 3 — Build parameterised scope clause
        // $1 is always formId.  The scope param follows as $2.
        const scopeParams = [formId];
        let paramIdx = 2;
        let baseWhere = 's.form_id = $1';

        if (filter.filterType === 'SELF') {
            scopeParams.push(filter.homeUnitId);          // $2 = homeUnitId
            baseWhere += ` AND (s.target_unit_id IS NULL OR s.target_unit_id = $${paramIdx++})`;
        } else if (filter.filterType === 'SCOPE') {
            scopeParams.push(filter.unitIds);             // $2 = uuid array
            baseWhere += ` AND (s.target_unit_id IS NULL OR s.target_unit_id = ANY($${paramIdx++}::uuid[]))`;
        }

        // COUNT — same params as base WHERE
        const countRes = await query(
            `SELECT COUNT(*) AS total
             FROM submissions s
             WHERE ${baseWhere}`,
            scopeParams
        );
        const total = parseInt(countRes.rows[0].total, 10);

        // DATA — LIMIT / OFFSET appended after scope params
        const limitParam = paramIdx;
        const offsetParam = paramIdx + 1;
        const dataParams = [...scopeParams, parsedLimit, offset];

        const dataRes = await query(
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
                u.name        AS target_unit_name,
                f.title       AS form_title,
                f.description AS form_description
             FROM submissions s
             JOIN forms f        ON f.id = s.form_id
             LEFT JOIN units u   ON u.id = s.target_unit_id
             WHERE ${baseWhere}
             ORDER BY s.submitted_at DESC
             LIMIT $${limitParam} OFFSET $${offsetParam}`,
            dataParams
        );

        const submissions = dataRes.rows.map((row) => ({
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
            formDescription: row.form_description ?? null,
        }));

        return {
            status: 200,
            body: {
                success: true,
                data: submissions,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit),
                },
            }
        };
    } catch (error) {
        console.error('CheckOps submissions list failed:', error);
        return {
            status: 500,
            body: {
                error: 'Submissions retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
