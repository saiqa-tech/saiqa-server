/**
 * CheckOps Findings - Delete Finding Endpoint
 * 
 * Authorization: Admin only
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsFindingsDelete',
    type: 'api',
    path: '/api/checkops/findings/:id',
    method: 'DELETE',
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

        // Authorization: Admin only
        if (!req.user || req.user.role !== 'admin') {
            return {
                status: 403,
                body: { error: 'Insufficient permissions. Admin access required.' }
            };
        }

        const checkopsWrapper = getCheckOpsWrapper();

        // Ensure CheckOps is initialized
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        // Safely extract id from params
        const id = req.params?.id;

        if (!id) {
            return {
                status: 400,
                body: { error: 'Finding ID is required' }
            };
        }

        // Get finding before deletion for audit trail
        const finding = await checkopsWrapper.getFinding(id);

        // Delete finding
        await checkopsWrapper.deleteFinding(id);

        // Log audit trail
        await logAudit({
            userId: req.user.id,
            action: 'DELETE',
            entityType: 'checkops_finding',
            entityId: finding.id,
            entitySid: finding.sid,
            changes: {
                deleted: true,
                formSid: finding.formSid,
                submissionSid: finding.submissionSid,
                severity: finding.severity,
                department: finding.department
            },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        console.log(`✅ Finding deleted: ${finding.sid} by admin ${req.user.id}`);

        return {
            status: 200,
            body: {
                success: true,
                message: 'Finding deleted successfully',
                data: finding
            }
        };
    } catch (error) {
        console.error('CheckOps finding deletion failed:', error);

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
                error: 'Finding deletion failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
