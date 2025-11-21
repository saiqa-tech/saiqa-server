const { query } = require('../config/database');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  comparePassword,
  hashPassword,
  hashToken,
  getCookieOptions
} = require('../utils/auth');
const { logAudit, getRequestInfo } = require('../utils/audit');
const { logActivity } = require('../utils/logger');

// Login endpoint
async function login(req, res) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      logActivity.security('LOGIN_FAILED', { email, reason: 'User not found', ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await comparePassword(password, user.password_hash);
    
    if (!isValidPassword) {
      logActivity.security('LOGIN_FAILED', { email, userId: user.id, reason: 'Invalid password', ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    // Store refresh token in database
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, expiresAt]
    );
    
    // Set cookies
    res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000)); // 15 minutes
    res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000)); // 7 days
    
    // Log audit
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ...requestInfo
    });
    
    logActivity.auth('LOGIN_SUCCESS', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...requestInfo
    });
    
    const { password_hash, ...userWithoutPassword } = user;
    
    return res.json({
      user: userWithoutPassword,
      requiresPasswordChange: user.force_password_change
    });
  } catch (error) {
    console.error('Login error:', error);
    logActivity.error(error, { context: 'login', email });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Refresh token endpoint
async function refresh(req, res) {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  try {
    const payload = verifyRefreshToken(refreshToken);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const refreshTokenHash = hashToken(refreshToken);
    
    const result = await query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > NOW()',
      [refreshTokenHash, payload.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    
    const newAccessToken = generateAccessToken(tokenPayload);
    
    res.cookie('accessToken', newAccessToken, getCookieOptions(15 * 60 * 1000));
    
    const { password_hash, ...userWithoutPassword } = user;
    
    return res.json({
      user: userWithoutPassword,
      requiresPasswordChange: user.force_password_change
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Logout endpoint
async function logout(req, res) {
  const refreshToken = req.cookies.refreshToken;
  
  try {
    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [refreshTokenHash]);
    }
    
    if (req.user) {
      const requestInfo = getRequestInfo(req);
      await logAudit({
        userId: req.user.userId,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user.userId,
        ...requestInfo
      });
      
      logActivity.auth('LOGOUT', {
        userId: req.user.userId,
        ...requestInfo
      });
    }
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Change password endpoint
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const newPasswordHash = await hashPassword(newPassword);
    
    await query(
      'UPDATE users SET password_hash = $1, force_password_change = false, updated_by = $2 WHERE id = $3',
      [newPasswordHash, userId, userId]
    );
    
    // Delete all refresh tokens for this user to force re-login on other devices
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    
    const requestInfo = getRequestInfo(req);
    await logAudit({
      userId: userId,
      action: 'CHANGE_PASSWORD',
      entityType: 'user',
      entityId: userId,
      ...requestInfo
    });
    
    logActivity.auth('PASSWORD_CHANGED', {
      userId,
      ...requestInfo
    });
    
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get current user endpoint
async function getCurrentUser(req, res) {
  try {
    const result = await query(
      `SELECT u.*, 
              un.name as unit_name, 
              d.title as designation_title
       FROM users u
       LEFT JOIN units un ON u.unit_id = un.id
       LEFT JOIN designations d ON u.designation_id = d.id
       WHERE u.id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { password_hash, ...user } = result.rows[0];
    
    return res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  login,
  refresh,
  logout,
  changePassword,
  getCurrentUser
};
