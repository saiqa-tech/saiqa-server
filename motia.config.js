require('dotenv').config();
const cors = require('cors');
const { initializeConfigCache } = require('./utils/config');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const config = {
  port: process.env.PORT || 3002,
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  /**
   * CORS enabled - allows specific origins with credentials
   */
  app(app) {
    app.use(cors({
      origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://localhost:3000'],
      credentials: true
    }));
  },
  /**
   * Lifecycle hook: Called when server starts
   */
  async onStart() {
    console.log('🚀 Saiqa Server starting...');

    // Initialize config cache
    try {
      await initializeConfigCache();
      console.log('✅ Configuration cache initialized');
    } catch (error) {
      console.error('⚠️  Failed to initialize config cache:', error.message);
      console.error('   Server will continue but config validation may use defaults');
    }
  }
};

// Support both ESM default import and CommonJS require()
module.exports = config;
module.exports.default = config;
