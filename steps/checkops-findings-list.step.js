/**
 * CheckOps Findings - List Findings with Filters Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsFindingsList',
    type: 'api',
    path: '/api/checkops/findings',
    method: 'GET',
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

        // Extract query parameters
        const {
            formId,
            submissionId,
            questionId,
            severity,
            department,
            status,
            createdAfter,
            createdBefore,
            limit = 100,
            offset = 0
        } = req.queryParams || {};

        // Build filters object
        const filters = {
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        };

        if (formId) filters.formId = formId;
        if (severity) filters.severity = severity;
        if (department) filters.department = department;
        if (status) filters.status = status;
        if (createdAfter) filters.createdAfter = createdAfter;
        if (createdBefore) filters.createdBefore = createdBefore;

        let findings;
        let totalCount;

        // Route to appropriate method based on query parameters
        if (submissionId) {
            // Get findings by submission
            findings = await checkopsWrapper.getFindingsBySubmission(submissionId);
            totalCount = findings.length;
        } else if (questionId) {
            // Get findings by question
            findings = await checkopsWrapper.getFindingsByQuestion(questionId, {
                limit: filters.limit,
                offset: filters.offset
            });
            totalCount = await checkopsWrapper.getFindingCount({ questionId });
        } else if (formId) {
            // Get findings by form
            findings = await checkopsWrapper.getFindingsByForm(formId, {
                limit: filters.limit,
                offset: filters.offset
            });
            totalCount = await checkopsWrapper.getFindingCount({ formId });
        } else {
            // Get all findings with filters
            findings = await checkopsWrapper.getFindings(filters);
            totalCount = await checkopsWrapper.getFindingCount(filters);
        }

        return {
            status: 200,
            body: {
                success: true,
                data: findings,
                pagination: {
                    total: totalCount,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: (filters.offset + findings.length) < totalCount
                }
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
