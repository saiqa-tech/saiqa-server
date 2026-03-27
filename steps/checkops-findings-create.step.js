/**
 * CheckOps Findings - Create Finding Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFindingData } = require('../lib/checkops-finding-validator');
const { logAudit } = require('../utils/audit');

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
