require('dotenv').config();
const { logger } = require('./utils/logger');
const { getCheckOpsWrapper } = require('./lib/checkops-wrapper');

// Health check endpoint
const config = {
  emits: [],
  name: 'HealthCheck',
  type: 'api',
  path: '/health',
  method: 'GET'
};

const handler = async (req, ctx) => {
  const health = {
    status: 'healthy',
    version: require('./package.json').version,
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy',
      checkops: 'disabled'
    }
  };

  try {
    // Check CheckOps health if enabled
    if (process.env.CHECKOPS_ENABLED === 'true') {
      const checkopsWrapper = getCheckOpsWrapper();

      if (checkopsWrapper.initialized) {
        const checkopsHealth = await checkopsWrapper.getHealthStatus();

        health.services.checkops = checkopsHealth.healthy ? 'healthy' : 'unhealthy';

        if (!checkopsHealth.healthy) {
          health.status = 'degraded';
          health.checkopsError = checkopsHealth.error;
        }

        // Add CheckOps metrics if available
        const metrics = checkopsWrapper.getMetrics();
        if (metrics) {
          health.checkopsMetrics = {
            operations: metrics.operations,
            errors: metrics.errors,
            errorRate: metrics.operations > 0 ? (metrics.errors / metrics.operations * 100).toFixed(2) + '%' : '0%',
            uptime: metrics.initTime ? Math.floor((Date.now() - new Date(metrics.initTime).getTime()) / 1000) : 0
          };
        }
      } else {
        health.services.checkops = 'not_initialized';
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    return {
      status: statusCode,
      body: health
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.services.checkops = 'error';
    health.error = error.message;

    return {
      status: 503,
      body: health
    };
  }
};

// Log server startup
logger.info(`Saiqa server initialized`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Saiqa server initialized`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

module.exports = { config, handler };
