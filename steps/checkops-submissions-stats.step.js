/**
 * CheckOps Submissions - Get Statistics Endpoint
 *
 * Phase 4: returns submission counts scoped to the requesting user's
 * authorised stores (target_unit_id filter).
 *
 * Uses direct SQL instead of the checkops wrapper so the scope WHERE clause
 * can be injected.  The per-question JSONB analysis that the checkops wrapper
 * performs is not reproduced here — questionStats is returned as an empty
 * array.  This is acceptable because useSubmissionStats is currently not
 * rendered in any UI component.
 */

require('dotenv').config();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsStats',
    type: 'api',
    path: '/api/checkops/submissions/stats',
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

        const { formId } = req.queryParams || {};

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        // Step 1 — Build the reporting filter for this user
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_SUBMISSION');

        // Step 2 — 403 if not allowed
        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view submission statistics.' }
            };
        }

        // Step 3 — Build parameterised scope clause
        // $1 = formId, scope param follows as $2
        const params = [formId];
        let scopeIdx = 2;
        let scopeClause = '';

        if (filter.filterType === 'SELF') {
            params.push(filter.homeUnitId);
            scopeClause = ` AND (s.target_unit_id IS NULL OR s.target_unit_id = $${scopeIdx})`;
        } else if (filter.filterType === 'SCOPE') {
            params.push(filter.unitIds);
            scopeClause = ` AND (s.target_unit_id IS NULL OR s.target_unit_id = ANY($${scopeIdx}::uuid[]))`;
        }

        const countRes = await query(
            `SELECT COUNT(*) AS total
             FROM submissions s
             WHERE s.form_id = $1${scopeClause}`,
            params
        );

        const totalSubmissions = parseInt(countRes.rows[0].total, 10);

        return {
            status: 200,
            body: {
                success: true,
                data: {
                    totalSubmissions,
                    questionStats: [],
                    completionRate: 0,
                }
            }
        };
    } catch (error) {
        console.error('CheckOps stats retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Stats retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
