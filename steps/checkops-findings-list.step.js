/**
 * CheckOps Findings - List Findings with Filters Endpoint
 *
 * Phase 4: returns only findings the requesting user is authorised to see,
 * scoped to stores within the user's authorised scope.
 *
 * The findings table has no target_unit_id column — scope is applied by
 * JOINing findings to submissions and filtering on submissions.target_unit_id.
 *
 * Uses direct SQL instead of checkops wrapper so the scope WHERE clause
 * can be injected.  Both saiqa-server and checkops share the same PostgreSQL
 * database.
 */

require('dotenv').config();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFindingsList',
    type: 'api',
    path: '/api/checkops/findings',
    method: 'GET',
    middleware: [authenticate]
};

// ---------------------------------------------------------------------------
// Helper: take a base WHERE string + base params array, append the scope
// clause, and return { where: string, params: array }.
// Does NOT mutate the input params array.
// ---------------------------------------------------------------------------
function withScope(baseWhere, baseParams, filter) {
    const params = [...baseParams];

    if (filter.filterType === 'ALL') {
        return { where: baseWhere, params };
    }

    const scopeIdx = params.length + 1;
    let where;

    if (filter.filterType === 'SELF') {
        params.push(filter.homeUnitId);
        where = `(${baseWhere}) AND (f.target_unit_id IS NULL OR f.target_unit_id = $${scopeIdx})`;
    } else {
        params.push(filter.unitIds);
        where = `(${baseWhere}) AND (f.target_unit_id IS NULL OR f.target_unit_id = ANY($${scopeIdx}::uuid[]))`;
    }

    return { where, params };
}

// Core SELECT + FROM + JOINs used by every branch.
// findings has a native target_unit_id column — no submissions JOIN needed for scope or data.
const CORE_SELECT = `
    SELECT
        f.id,
        f.sid,
        f.submission_id,
        f.submission_sid,
        f.question_id,
        f.question_sid,
        f.form_id,
        f.form_sid,
        f.severity,
        f.department,
        f.observation,
        f.root_cause,
        f.evidence_urls,
        f.assignment,
        f.status,
        f.metadata,
        f.created_at,
        f.created_by,
        f.target_unit_id,
        forms.title      AS form_title,
        qb.question_text AS question_text,
        u.name           AS target_unit_name
    FROM public.findings f
    JOIN forms              ON forms.id = f.form_id
    JOIN question_bank qb   ON qb.id = f.question_id
    LEFT JOIN units u       ON u.id = f.target_unit_id
`;

function mapRow(row) {
    return {
        id: row.id,
        sid: row.sid,
        submissionId: row.submission_id,
        submissionSid: row.submission_sid,
        questionId: row.question_id,
        questionSid: row.question_sid,
        formId: row.form_id,
        formSid: row.form_sid,
        severity: row.severity,
        department: row.department,
        observation: row.observation,
        rootCause: row.root_cause,
        evidenceUrls: row.evidence_urls ?? undefined,
        assignment: row.assignment,
        status: row.status,
        metadata: row.metadata,
        createdAt: row.created_at,
        // findings table has no updated_at column — return created_at as fallback
        updatedAt: row.created_at,
        createdBy: row.created_by,
        targetUnitId: row.target_unit_id ?? null,
        // FindingWithContextSchema extras
        formTitle: row.form_title,
        questionText: row.question_text,
        targetUnitName: row.target_unit_name ?? null,
    };
}

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const {
            formId,
            submissionId,
            questionId,
            severity,
            department,
            status,
            limit = 20,
            page = 1,
        } = req.queryParams || {};

        const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedOffset = (parsedPage - 1) * parsedLimit;

        // Validate UUID filter params so malformed input returns 400 instead of
        // a PostgreSQL "invalid input syntax for type uuid" 500.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (formId && !UUID_RE.test(formId)) {
            return { status: 400, body: { error: 'formId must be a valid UUID' } };
        }
        if (submissionId && !UUID_RE.test(submissionId)) {
            return { status: 400, body: { error: 'submissionId must be a valid UUID' } };
        }
        if (questionId && !UUID_RE.test(questionId)) {
            return { status: 400, body: { error: 'questionId must be a valid UUID' } };
        }

        // Step 1 — Build the reporting filter for this user
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_FINDING');

        // Step 2 — 403 if not allowed
        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view findings.' }
            };
        }

        let findings;
        let totalCount;

        if (submissionId) {
            // Branch 1: findings for a specific submission
            const { where, params } = withScope('f.submission_id = $1', [submissionId], filter);
            const limitIdx = params.length + 1;
            const offsetIdx = params.length + 2;

            const [dataRes, countRes] = await Promise.all([
                query(
                    `${CORE_SELECT} WHERE ${where}
                     ORDER BY f.created_at DESC
                     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
                    [...params, parsedLimit, parsedOffset]
                ),
                query(
                    `SELECT COUNT(*) AS total FROM public.findings f WHERE ${where}`,
                    params
                ),
            ]);
            findings = dataRes.rows;
            totalCount = parseInt(countRes.rows[0].total, 10);

        } else if (questionId) {
            // Branch 2: findings for a specific question
            const { where, params } = withScope('f.question_id = $1', [questionId], filter);
            const limitIdx = params.length + 1;
            const offsetIdx = params.length + 2;

            const [dataRes, countRes] = await Promise.all([
                query(
                    `${CORE_SELECT} WHERE ${where}
                     ORDER BY f.created_at DESC
                     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
                    [...params, parsedLimit, parsedOffset]
                ),
                query(
                    `SELECT COUNT(*) AS total
                     FROM public.findings f
                     WHERE ${where}`,
                    params
                ),
            ]);
            findings = dataRes.rows;
            totalCount = parseInt(countRes.rows[0].total, 10);

        } else if (formId) {
            // Branch 3: findings for a specific form
            const { where, params } = withScope('f.form_id = $1', [formId], filter);
            const limitIdx = params.length + 1;
            const offsetIdx = params.length + 2;

            const [dataRes, countRes] = await Promise.all([
                query(
                    `${CORE_SELECT} WHERE ${where}
                     ORDER BY f.created_at DESC
                     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
                    [...params, parsedLimit, parsedOffset]
                ),
                query(
                    `SELECT COUNT(*) AS total
                     FROM public.findings f
                     WHERE ${where}`,
                    params
                ),
            ]);
            findings = dataRes.rows;
            totalCount = parseInt(countRes.rows[0].total, 10);

        } else {
            // Branch 4: all findings, with optional attribute filters
            const conditions = [];
            const baseParams = [];

            if (severity) {
                baseParams.push(severity);
                conditions.push(`f.severity = $${baseParams.length}`);
            }
            if (department) {
                baseParams.push(department);
                conditions.push(`f.department = $${baseParams.length}`);
            }
            if (status) {
                baseParams.push(status);
                conditions.push(`f.status = $${baseParams.length}`);
            }

            const baseWhere = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

            const { where: countWhere, params: countParams } =
                withScope(baseWhere, baseParams, filter);

            const { where, params } = withScope(baseWhere, baseParams, filter);
            const limitIdx = params.length + 1;
            const offsetIdx = params.length + 2;

            const [dataRes, countRes] = await Promise.all([
                query(
                    `${CORE_SELECT} WHERE ${where}
                     ORDER BY f.created_at DESC
                     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
                    [...params, parsedLimit, parsedOffset]
                ),
                query(
                    `SELECT COUNT(*) AS total
                     FROM public.findings f
                     WHERE ${countWhere}`,
                    countParams
                ),
            ]);
            findings = dataRes.rows;
            totalCount = parseInt(countRes.rows[0].total, 10);
        }

        const findingsList = findings.map(mapRow);
        const totalPages = Math.ceil(totalCount / parsedLimit);

        return {
            status: 200,
            body: {
                success: true,
                data: findingsList,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total: totalCount,
                    totalPages,
                },
            }
        };
    } catch (error) {
        console.error('CheckOps findings list failed:', error);
        return {
            status: 500,
            body: {
                error: 'Findings list retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
