const crypto = require('crypto');

/**
 * Generate a cryptographically secure random password
 * @param {number} length - Length of the password (default: 12)
 * @returns {string} - Secure random password
 */
function generateSecurePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomBytes = crypto.randomBytes(length);

    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(randomBytes[i] % charset.length);
    }

    return password;
}

module.exports = { generateSecurePassword };
