/**
 * CheckOps Config - Update Findings Values Endpoint
 *
 * Updates the allowed severities and departments for findings.
 * PUT /api/checkops/config/findings-values
 *
 * Body: { severities: string[], departments: string[] }
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { setConfig, refreshConfigCache } = require('../utils/config');

const config = {
    emits: [],
    name: 'CheckOpsConfigFindingsValuesPut',
    type: 'api',
    path: '/api/checkops/config/findings-values',
    method: 'PUT',
    middleware: [authenticate],
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return { status: 503, body: { error: 'CheckOps is not enabled' } };
        }

        const { severities, departments } = req.body ?? {};

        // Validate severities
        if (!Array.isArray(severities) || severities.length === 0) {
            return {
                status: 400,
                body: { error: 'severities must be a non-empty array of strings' },
            };
        }
        if (severities.some((s) => typeof s !== 'string' || s.trim() === '')) {
            return {
                status: 400,
                body: { error: 'Each severity must be a non-empty string' },
            };
        }

        // Validate departments
        if (!Array.isArray(departments) || departments.length === 0) {
            return {
                status: 400,
                body: { error: 'departments must be a non-empty array of strings' },
            };
        }
        if (departments.some((d) => typeof d !== 'string' || d.trim() === '')) {
            return {
                status: 400,
                body: { error: 'Each department must be a non-empty string' },
            };
        }

        const updatedBy = req.user?.username ?? 'admin';

        await Promise.all([
            setConfig('finding_severities', severities, {
                description: 'Allowed severity values for findings',
                category: 'finding',
                updatedBy,
            }),
            setConfig('finding_departments', departments, {
                description: 'Allowed department values for findings',
                category: 'finding',
                updatedBy,
            }),
        ]);

        // Refresh the in-memory cache so subsequent reads see the new values
        await refreshConfigCache();

        return {
            status: 200,
            body: {
                success: true,
                data: { severities, departments },
            },
        };
    } catch (error) {
        console.error('Findings values update failed:', error);
        return {
            status: 500,
            body: { error: 'Findings values update failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
