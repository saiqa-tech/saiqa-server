require('dotenv').config();
const { logger } = require('./utils/logger');

// Health check endpoint
const config = {
  name: 'HealthCheck',
  type: 'api',
  path: '/health',
  method: 'GET'
};

const handler = async (req, ctx) => {
  return {
    status: 200,
    body: {
      status: 'ok',
      version: require('./package.json').version,
      timestamp: new Date().toISOString()
    }
  };
};

// Log server startup
logger.info(`Saiqa server initialized`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Saiqa server initialized`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

module.exports = { config, handler };
