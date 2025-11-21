const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'saiqa-server' },
  transports: [
    // Write all logs to activity.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/activity.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Write error logs separately
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for structured logging
const logActivity = {
  auth: (action, details) => {
    logger.info('AUTH', {
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  user: (action, userId, details) => {
    logger.info('USER_MANAGEMENT', {
      action,
      userId,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  unit: (action, unitId, details) => {
    logger.info('UNIT_MANAGEMENT', {
      action,
      unitId,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  designation: (action, designationId, details) => {
    logger.info('DESIGNATION_MANAGEMENT', {
      action,
      designationId,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  api: (method, path, statusCode, userId, duration, details = {}) => {
    logger.info('API_REQUEST', {
      method,
      path,
      statusCode,
      userId,
      duration,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  error: (error, context = {}) => {
    logger.error('ERROR', {
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: new Date().toISOString()
    });
  },

  security: (event, details) => {
    logger.warn('SECURITY', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { logger, logActivity };
