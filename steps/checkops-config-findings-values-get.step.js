/**
 * CheckOps Config - Get Findings Values Endpoint
 *
 * Returns the current allowed severities and departments for findings.
 * GET /api/checkops/config/findings-values
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getConfig } = require('../utils/config');
const {
    DEFAULT_SEVERITIES,
    DEFAULT_DEPARTMENTS,
} = require('../lib/checkops-finding-validator');

const config = {
    emits: [],
    name: 'CheckOpsConfigFindingsValuesGet',
    type: 'api',
    path: '/api/checkops/config/findings-values',
    method: 'GET',
    middleware: [authenticate],
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return { status: 503, body: { error: 'CheckOps is not enabled' } };
        }

        const [severities, departments] = await Promise.all([
            getConfig('finding_severities', DEFAULT_SEVERITIES),
            getConfig('finding_departments', DEFAULT_DEPARTMENTS),
        ]);

        return {
            status: 200,
            body: {
                success: true,
                data: { severities, departments },
            },
        };
    } catch (error) {
        console.error('Findings values retrieval failed:', error);
        return {
            status: 500,
            body: { error: 'Findings values retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
