/**
 * CheckOps Findings - Get Statistics Endpoint
 *
 * Phase 4: returns aggregate counts scoped to the requesting user's
 * authorised stores (via the submissions.target_unit_id JOIN).
 *
 * Uses direct SQL instead of the checkops wrapper so the scope WHERE clause
 * can be injected.
 *
 * Path changed from /api/checkops/findings/stats/:formId (path param) to
 * /api/checkops/findings/stats?formId=xxx (optional query param) to match
 * the client's getFindingStats() call.
 */

require('dotenv').config();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFindingsStats',
    type: 'api',
    path: '/api/checkops/findings-stats',
    method: 'GET',
    middleware: [authenticate]
};

// findings has a native target_unit_id — no submissions JOIN needed.
const FROM_JOIN = `
    FROM public.findings f
`;

function appendWhereCondition(whereClause, condition) {
    return whereClause
        ? `${whereClause} AND ${condition}`
        : `WHERE ${condition}`;
}

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const { formId } = req.queryParams || {};

        // Step 1 — Build the reporting filter for this user
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_FINDING');

        // Step 2 — 403 if not allowed
        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view finding statistics.' }
            };
        }

        // Validate UUID filter param so malformed input returns 400 instead of
        // a PostgreSQL "invalid input syntax for type uuid" 500.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (formId && !UUID_RE.test(formId)) {
            return { status: 400, body: { error: 'formId must be a valid UUID' } };
        }

        // Step 3 — Build parameterised WHERE clause
        // Optional formId filter comes first ($1 if present), scope filter follows.
        const baseParams = [];
        let baseWhere = '';

        if (formId) {
            baseParams.push(formId);
            baseWhere = `f.form_id = $${baseParams.length}`;
        }

        let whereClause = baseWhere ? `WHERE ${baseWhere}` : '';
        const params = [...baseParams];

        if (filter.filterType === 'SELF') {
            params.push(filter.homeUnitId);
            whereClause = appendWhereCondition(
                whereClause,
                `(f.target_unit_id IS NULL OR f.target_unit_id = $${params.length})`
            );
        } else if (filter.filterType === 'SCOPE') {
            params.push(filter.unitIds);
            whereClause = appendWhereCondition(
                whereClause,
                `(f.target_unit_id IS NULL OR f.target_unit_id = ANY($${params.length}::uuid[]))`
            );
        }

        // Run all aggregate queries in parallel for efficiency
        const [summaryRes, severityRes, departmentRes, statusRes, formRes] =
            await Promise.all([
                // Total count
                query(
                    `SELECT COUNT(*) AS total ${FROM_JOIN} ${whereClause}`,
                    params
                ),
                // By severity
                query(
                    `SELECT f.severity, COUNT(*) AS count
                     ${FROM_JOIN}
                     ${appendWhereCondition(whereClause, 'f.severity IS NOT NULL')}
                     GROUP BY f.severity`,
                    params
                ),
                // By department
                query(
                    `SELECT f.department, COUNT(*) AS count
                     ${FROM_JOIN}
                     ${appendWhereCondition(whereClause, 'f.department IS NOT NULL')}
                     GROUP BY f.department`,
                    params
                ),
                // By status
                query(
                    `SELECT f.status, COUNT(*) AS count
                     ${FROM_JOIN}
                     ${appendWhereCondition(whereClause, 'f.status IS NOT NULL')}
                     GROUP BY f.status`,
                    params
                ),
                // By form (when no formId filter: all forms; when formId: single entry)
                query(
                    `SELECT f.form_id, COUNT(*) AS count
                     ${FROM_JOIN}
                     ${whereClause}
                     GROUP BY f.form_id`,
                    params
                ),
            ]);

        const total = parseInt(summaryRes.rows[0].total, 10);

        const bySeverity = Object.fromEntries(
            severityRes.rows.map((r) => [r.severity, parseInt(r.count, 10)])
        );
        const byDepartment = Object.fromEntries(
            departmentRes.rows.map((r) => [r.department, parseInt(r.count, 10)])
        );
        const byStatus = Object.fromEntries(
            statusRes.rows.map((r) => [r.status, parseInt(r.count, 10)])
        );
        const byForm = Object.fromEntries(
            formRes.rows.map((r) => [r.form_id, parseInt(r.count, 10)])
        );

        return {
            status: 200,
            body: {
                success: true,
                data: { total, bySeverity, byDepartment, byStatus, byForm },
                formId: formId || null,
            }
        };
    } catch (error) {
        console.error('CheckOps findings stats failed:', error);

        if (error.message && error.message.includes('not found')) {
            return {
                status: 404,
                body: {
                    error: 'Form not found',
                    message: error.message
                }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Findings stats retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
