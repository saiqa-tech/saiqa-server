/**
 * CheckOps Metrics Endpoint
 * Returns operational metrics and system health data
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

const config = {
    emits: [],
    name: 'CheckOpsMetrics',
    type: 'api',
    path: '/api/checkops/metrics',
    method: 'GET'
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

        const checkops = getCheckOpsWrapper();

        if (!checkops.initialized) {
            return {
                status: 503,
                body: { error: 'CheckOps not initialized' }
            };
        }

        const metrics = checkops.getMetrics();
        const productionMetrics = checkops.getProductionMetrics();
        const healthData = checkops.getHealthCheckData();

        return {
            status: 200,
            body: {
                success: true,
                data: {
                    wrapper: metrics,
                    production: productionMetrics,
                    health: healthData,
                    system: {
                        uptime: process.uptime(),
                        memoryUsage: process.memoryUsage(),
                        nodeVersion: process.version
                    }
                }
            }
        };
    } catch (error) {
        console.error('CheckOps metrics retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Metrics retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
