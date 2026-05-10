/**
 * CheckOps Findings - Create Finding Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFindingData } = require('../lib/checkops-finding-validator');
const { logAudit } = require('../utils/audit');
const { query } = require('../config/database');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFindingsCreate',
    type: 'api',
    path: '/api/checkops/findings',
    method: 'POST',
    middleware: [authenticate]
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

        // Validate request body
        const validationErrors = await validateFindingData(req.body);
        if (validationErrors.length > 0) {
            return {
                status: 400,
                body: {
                    error: 'Validation failed',
                    details: validationErrors
                }
            };
        }

        // ── Scope gate ────────────────────────────────────────────────────────
        // Only allow creating findings for submissions the caller is authorised to see.
        // This mirrors the scope enforcement in checkops-findings-update.step.js.
        const submissionId = req.body.submissionId;
        let targetUnitId = null;

        if (submissionId) {
            // submissionId can be either a UUID or a SID
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const idCol = UUID_RE.test(submissionId) ? 'id' : 'sid';
            const subRes = await query(
                `SELECT target_unit_id FROM submissions WHERE ${idCol} = $1`,
                [submissionId]
            );
            if (subRes.rows.length === 0) {
                return {
                    status: 404,
                    body: { error: 'Submission not found' }
                };
            }

            targetUnitId = subRes.rows[0].target_unit_id;
        }

        const filter = await buildReportingFilter(req.user.userId, 'UPDATE_FINDING');

        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to create findings.' }
            };
        }

        // NULL target_unit_id = legacy submission created before Phase 3 — visible to all authorized viewers.
        if (targetUnitId !== null) {
            if (filter.filterType === 'SELF' && targetUnitId !== filter.homeUnitId) {
                return {
                    status: 403,
                    body: { error: 'You do not have permission to create findings for this submission.' }
                };
            }
            if (filter.filterType === 'SCOPE' && !filter.unitIds.includes(targetUnitId)) {
                return {
                    status: 403,
                    body: { error: 'You do not have permission to create findings for this submission.' }
                };
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // Create finding with user context
        const finding = await checkopsWrapper.createFinding({
            ...req.body,
            status: req.body.status || 'open', // Default to 'open' if not provided
            createdBy: req.user?.email || req.user?.id || 'anonymous'
        });

        // Log audit trail
        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            entityType: 'checkops_finding',
            entityId: finding.id,
            entitySid: finding.sid,
            changes: {
                formSid: finding.formSid,
                submissionSid: finding.submissionSid,
                questionSid: finding.questionSid,
                severity: finding.severity,
                department: finding.department,
                status: finding.status
            },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        console.log(`✅ Finding created: ${finding.sid} (${finding.id}) by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 201,
            body: {
                success: true,
                data: finding
            }
        };
    } catch (error) {
        console.error('CheckOps finding creation failed:', error);
        return {
            status: 500,
            body: {
                error: 'Finding creation failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
