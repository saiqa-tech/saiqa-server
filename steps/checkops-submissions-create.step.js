/**
 * CheckOps Submissions - Create Submission Endpoint (Post-Fix Implementation)
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateSubmissionData } = require('../lib/checkops-validation');
const { createSubmissionWithQuestionIds } = require('../lib/checkops-question-id-mapper');
const { logAudit } = require('../utils/audit');

const config = {
    emits: [],
    name: 'CheckOpsSubmissionsCreate',
    type: 'api',
    path: '/api/checkops/submissions',
    method: 'POST'
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

        const { formId, submissionData } = req.body;

        const validationErrors = validateSubmissionData({
            formId,
            submissionData,
            submittedBy: req.user?.id
        });

        if (validationErrors.length > 0) {
            return {
                status: 400,
                body: {
                    error: 'Validation failed',
                    details: validationErrors
                }
            };
        }

        // Create submission using proper CheckOps workflow (post-fix)
        // Now submissions work directly with question IDs as documented
        const submission = await createSubmissionWithQuestionIds({
            formId,
            submissionData,
            metadata: {
                submittedBy: req.user?.id,
                submittedAt: new Date().toISOString(),
                ipAddress: req.ip || req.headers?.['x-forwarded-for'],
                userAgent: req.headers?.['user-agent']
            }
        });

        // Log audit trail
        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            entityType: 'checkops_submission',
            entityId: submission.id,
            entitySid: submission.sid,  // NEW: Human-readable ID
            changes: {
                formId,
                formSid: submission.formSid,  // Include form SID for reference
                dataKeys: Object.keys(submissionData)
            },
            ipAddress: req.ip || req.headers?.['x-forwarded-for'],
            userAgent: req.headers?.['user-agent']
        });

        // Enhanced logging
        console.log(`✅ Submission created via API: ${submission.sid} (${submission.id}) for form ${submission.formSid} by user ${req.user?.id || 'anonymous'}`);

        return {
            status: 201,
            body: {
                success: true,
                data: submission
            }
        };
    } catch (error) {
        console.error('CheckOps submission creation failed:', error);
        return {
            status: 500,
            body: {
                error: 'Submission creation failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
