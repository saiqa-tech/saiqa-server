const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const authSteps = require('./steps/auth');
const userSteps = require('./steps/users');
const unitSteps = require('./steps/units');
const designationSteps = require('./steps/designations');
const { authenticate, adminOnly, managerOrAdmin } = require('./middleware/auth');
const { requestLogger } = require('./middleware/logger');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/login', authSteps.login);
app.post('/api/auth/refresh', authSteps.refresh);
app.post('/api/auth/logout', authSteps.logout);
app.post('/api/auth/change-password', authenticate, authSteps.changePassword);
app.get('/api/auth/me', authenticate, authSteps.getCurrentUser);

// User routes
app.get('/api/users', authenticate, managerOrAdmin, userSteps.getUsers);
app.get('/api/users/:id', authenticate, managerOrAdmin, userSteps.getUserById);
app.post('/api/users', authenticate, adminOnly, userSteps.createUser);
app.put('/api/users/:id', authenticate, adminOnly, userSteps.updateUser);
app.delete('/api/users/:id', authenticate, adminOnly, userSteps.deleteUser);
app.post('/api/users/:id/reset-password', authenticate, adminOnly, userSteps.resetUserPassword);

// Unit routes
app.get('/api/units', authenticate, unitSteps.getUnits);
app.get('/api/units/:id', authenticate, unitSteps.getUnitById);
app.post('/api/units', authenticate, adminOnly, unitSteps.createUnit);
app.put('/api/units/:id', authenticate, adminOnly, unitSteps.updateUnit);
app.delete('/api/units/:id', authenticate, adminOnly, unitSteps.deleteUnit);

// Designation routes
app.get('/api/designations', authenticate, designationSteps.getDesignations);
app.get('/api/designations/:id', authenticate, designationSteps.getDesignationById);
app.post('/api/designations', authenticate, adminOnly, designationSteps.createDesignation);
app.put('/api/designations/:id', authenticate, adminOnly, designationSteps.updateDesignation);
app.delete('/api/designations/:id', authenticate, adminOnly, designationSteps.deleteDesignation);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`Saiqa server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Saiqa server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
