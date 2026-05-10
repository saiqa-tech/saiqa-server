/**
 * CheckOps Findings - Get Single Finding Endpoint
 *
 * Scope enforcement (same rules as findings list):
 *   filterType ALL   → any authorized viewer can read any finding
 *   filterType SELF  → finding's target_unit_id must match homeUnitId OR be NULL
 *   filterType SCOPE → finding's target_unit_id must be in the unit list OR be NULL
 *
 * NULL target_unit_id = legacy finding created before Phase 3; visible to all
 * authorized viewers (consistent with Policy Decision 1 in 00-foundations.md).
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFindingsGet',
    type: 'api',
    path: '/api/checkops/findings/:id',
    method: 'GET',
    middleware: [authenticate]
};

// Reuse the same SELECT used by the list endpoint so the response shape is identical.
const FINDING_SELECT = `
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
    JOIN forms         ON forms.id = f.form_id
    JOIN question_bank qb ON qb.id = f.question_id
    LEFT JOIN units    u  ON u.id  = f.target_unit_id
`;

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const id = req.pathParams?.id;

        if (!id) {
            return {
                status: 400,
                body: { error: 'Finding ID is required' }
            };
        }

        // Check permission before touching any finding data.
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_FINDING');

        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view findings.' }
            };
        }

        // Determine whether id is a UUID or a SID so we query the right column.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const idColumn = UUID_RE.test(id) ? 'f.id' : 'f.sid';

        const res = await query(
            `${FINDING_SELECT} WHERE ${idColumn} = $1`,
            [id]
        );

        if (res.rows.length === 0) {
            return {
                status: 404,
                body: { error: 'Finding not found' }
            };
        }

        const row = res.rows[0];

        // Scope check after the 404 so we don't reveal existence to unauthorized callers.
        // NULL target_unit_id = legacy row — always visible to authorized viewers.
        if (filter.filterType === 'SELF') {
            if (row.target_unit_id !== null && row.target_unit_id !== filter.homeUnitId) {
                return {
                    status: 404,
                    body: { error: 'Finding not found' }
                };
            }
        } else if (filter.filterType === 'SCOPE') {
            if (row.target_unit_id !== null && !filter.unitIds.includes(row.target_unit_id)) {
                return {
                    status: 404,
                    body: { error: 'Finding not found' }
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
                    formTitle: row.form_title,
                    questionText: row.question_text,
                    targetUnitName: row.target_unit_name ?? null,
                }
            }
        };
    } catch (error) {
        console.error('CheckOps finding retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Finding retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
