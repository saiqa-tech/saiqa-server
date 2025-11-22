require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};
