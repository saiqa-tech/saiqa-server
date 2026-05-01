/**
 * CheckOps Findings - Update Finding Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFindingUpdateData } = require('../lib/checkops-finding-validator');
const { logAudit } = require('../utils/audit');
const { buildReportingFilter } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFindingsUpdate',
    type: 'api',
    path: '/api/checkops/findings/:id',
    method: 'PUT',
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

        const id = req.pathParams?.id;

        if (!id) {
            return {
                status: 400,
                body: { error: 'Finding ID is required' }
            };
        }

        // Check permission first.
        const filter = await buildReportingFilter(req.user.userId, 'UPDATE_FINDING');

        if (!filter.allow) {
            return {
                status: 403,
                body: { error: 'You do not have permission to update findings.' }
            };
        }

        // Scope gate: fetch target_unit_id to verify the caller is allowed to edit
        // this specific finding without revealing its existence until we know they
        // can access it.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const idColumn = UUID_RE.test(id) ? 'id' : 'sid';
        const scopeRes = await query(
            `SELECT target_unit_id FROM public.findings WHERE ${idColumn} = $1`,
            [id]
        );

        if (scopeRes.rows.length === 0) {
            return {
                status: 404,
                body: { error: 'Finding not found' }
            };
        }

        const targetUnitId = scopeRes.rows[0].target_unit_id;

        // NULL target_unit_id = legacy row — always visible to authorized viewers.
        if (filter.filterType === 'SELF') {
            if (targetUnitId !== null && targetUnitId !== filter.homeUnitId) {
                return {
                    status: 403,
                    body: { error: 'You do not have permission to update this finding.' }
                };
            }
        } else if (filter.filterType === 'SCOPE') {
            if (targetUnitId !== null && !filter.unitIds.includes(targetUnitId)) {
                return {
                    status: 403,
                    body: { error: 'You do not have permission to update this finding.' }
                };
            }
        }

        // Validate update data
        const validationErrors = await validateFindingUpdateData(req.body);
        if (validationErrors.length > 0) {
            return {
                status: 400,
                body: {
                    error: 'Validation failed',
                    details: validationErrors
                }
            };
        }

        // Get existing finding for audit trail
        const existingFinding = await checkopsWrapper.getFinding(id);

        // Update finding
        const updatedFinding = await checkopsWrapper.updateFinding(id, req.body);

        // Build changes object for audit
        const changes = {};
        Object.keys(req.body).forEach(key => {
            if (JSON.stringify(existingFinding[key]) !== JSON.stringify(req.body[key])) {
                changes[key] = {
                    from: existingFinding[key],
                    to: req.body[key]
                };
            }
        });

        // Log audit trail
        await logAudit({
            userId: req.user?.userId,
            action: 'UPDATE',
            entityType: 'checkops_finding',
            entityId: updatedFinding.id,
            entitySid: updatedFinding.sid,
            changes,
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        console.log(`✅ Finding updated: ${updatedFinding.sid} by user ${req.user?.userId || 'anonymous'}`);

        return {
            status: 200,
            body: {
                success: true,
                data: updatedFinding
            }
        };
    } catch (error) {
        console.error('CheckOps finding update failed:', error);

        // Handle not found errors
        if (error.message && error.message.includes('not found')) {
            return {
                status: 404,
                body: {
                    error: 'Finding not found',
                    message: error.message
                }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Finding update failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
