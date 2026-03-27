/**
 * CheckOps Findings - Update Finding Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFindingUpdateData } = require('../lib/checkops-finding-validator');
const { logAudit } = require('../utils/audit');

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

        // Safely extract id from params
        const id = req.params?.id;

        if (!id) {
            return {
                status: 400,
                body: { error: 'Finding ID is required' }
            };
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
            userId: req.user?.id,
            action: 'UPDATE',
            entityType: 'checkops_finding',
            entityId: updatedFinding.id,
            entitySid: updatedFinding.sid,
            changes,
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        console.log(`✅ Finding updated: ${updatedFinding.sid} by user ${req.user?.id || 'anonymous'}`);

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
