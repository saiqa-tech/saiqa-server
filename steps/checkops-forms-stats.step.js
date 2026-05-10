/**
 * CheckOps Forms - Get Form Statistics Endpoint
 *
 * Returns form data enriched with computed statistics:
 * submissionCount, questionCount, and lastSubmissionAt.
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFormsStats',
    type: 'api',
    path: '/api/checkops/forms/:formId/stats',
    method: 'GET',
    middleware: [authenticate],
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return { status: 503, body: { error: 'CheckOps is not enabled' } };
        }

        const checkopsWrapper = getCheckOpsWrapper();
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        const { formId } = req.pathParams;

        if (!formId) {
            return { status: 400, body: { error: 'Form ID is required' } };
        }

        const form = await checkopsWrapper.getForm(formId);

        if (!form) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        const questionCount = Array.isArray(form.questions) ? form.questions.length : 0;

        // Build the reporting filter — same pattern as checkops-submissions-stats.step.js.
        // This enforces scope: store employees see only own-store counts, managers see only their scope.
        const filter = await buildReportingFilter(req.user.userId, 'VIEW_SUBMISSION');

        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to view submission statistics.' }
            };
        }

        // Build scoped WHERE clause against the shared submissions table.
        // $1 = form UUID.  Scope param follows as $2 when a scope restriction applies.
        const params = [form.id];
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
            `SELECT COUNT(*) AS total FROM submissions s WHERE s.form_id = $1${scopeClause}`,
            params
        );
        const submissionCount = parseInt(countRes.rows[0].total, 10);

        // Fetch the most recent submission within scope to get lastSubmissionAt.
        let lastSubmissionAt = null;
        if (submissionCount > 0) {
            const lastRes = await query(
                `SELECT submitted_at FROM submissions s WHERE s.form_id = $1${scopeClause} ORDER BY s.submitted_at DESC LIMIT 1`,
                params
            );
            if (lastRes.rows.length > 0) {
                lastSubmissionAt = lastRes.rows[0].submitted_at || null;
            }
        }

        return {
            status: 200,
            body: {
                success: true,
                data: {
                    ...form,
                    submissionCount,
                    questionCount,
                    lastSubmissionAt,
                },
            },
        };
    } catch (error) {
        console.error('CheckOps form stats failed:', error);

        if (error.message.includes('not found')) {
            return { status: 404, body: { error: 'Form not found' } };
        }

        return {
            status: 500,
            body: { error: 'Form stats retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
