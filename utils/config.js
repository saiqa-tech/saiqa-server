/**
 * Configuration Utility
 * 
 * Provides cached access to configuration values stored in the database.
 * Configurations are cached in memory for performance.
 */

const { query } = require('../config/database');

// In-memory cache for config values
const configCache = new Map();
let cacheInitialized = false;

/**
 * Initialize config cache by loading all active configs
 */
async function initializeConfigCache() {
    try {
        const result = await query(
            'SELECT key, value, description, category FROM config WHERE is_active = true'
        );

        configCache.clear();
        result.rows.forEach(row => {
            configCache.set(row.key, {
                value: row.value,
                description: row.description,
                category: row.category
            });
        });

        cacheInitialized = true;
        console.log(`✅ Config cache initialized with ${configCache.size} entries`);
    } catch (error) {
        console.error('Failed to initialize config cache:', error);
        throw error;
    }
}

/**
 * Get configuration value by key
 * @param {string} key - Configuration key
 * @param {any} defaultValue - Default value if config not found
 * @returns {Promise<any>}
 */
async function getConfig(key, defaultValue = null) {
    // Initialize cache on first use
    if (!cacheInitialized) {
        await initializeConfigCache();
    }

    const config = configCache.get(key);
    return config ? config.value : defaultValue;
}

/**
 * Get all configurations by category
 * @param {string} category - Configuration category
 * @returns {Promise<object>}
 */
async function getConfigsByCategory(category) {
    if (!cacheInitialized) {
        await initializeConfigCache();
    }

    const configs = {};
    for (const [key, config] of configCache.entries()) {
        if (config.category === category) {
            configs[key] = config.value;
        }
    }

    return configs;
}

/**
 * Get all configurations
 * @returns {Promise<Array>}
 */
async function getAllConfigs() {
    const result = await query(
        'SELECT key, value, description, category, is_active, created_at, updated_at FROM config ORDER BY category, key'
    );

    return result.rows;
}

/**
 * Get single configuration with metadata
 * @param {string} key - Configuration key
 * @returns {Promise<object|null>}
 */
async function getConfigWithMetadata(key) {
    const result = await query(
        'SELECT * FROM config WHERE key = $1',
        [key]
    );

    return result.rows[0] || null;
}

/**
 * Set configuration value (creates or updates)
 * @param {string} key - Configuration key
 * @param {any} value - Configuration value (will be stored as JSONB)
 * @param {object} options - Additional options
 * @returns {Promise<object>}
 */
async function setConfig(key, value, options = {}) {
    const {
        description = null,
        category = null,
        updatedBy = 'system'
    } = options;

    const result = await query(
        `INSERT INTO config (key, value, description, category, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       description = COALESCE(EXCLUDED.description, config.description),
       category = COALESCE(EXCLUDED.category, config.category),
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     RETURNING *`,
        [key, JSON.stringify(value), description, category, updatedBy]
    );

    // Update cache
    configCache.set(key, {
        value: result.rows[0].value,
        description: result.rows[0].description,
        category: result.rows[0].category
    });

    return result.rows[0];
}

/**
 * Delete configuration
 * @param {string} key - Configuration key
 * @returns {Promise<boolean>}
 */
async function deleteConfig(key) {
    const result = await query(
        'DELETE FROM config WHERE key = $1 RETURNING *',
        [key]
    );

    if (result.rows.length > 0) {
        configCache.delete(key);
        return true;
    }

    return false;
}

/**
 * Refresh config cache
 */
async function refreshConfigCache() {
    await initializeConfigCache();
}

/**
 * Clear config cache
 */
function clearConfigCache() {
    configCache.clear();
    cacheInitialized = false;
}

module.exports = {
    initializeConfigCache,
    getConfig,
    getConfigsByCategory,
    getAllConfigs,
    getConfigWithMetadata,
    setConfig,
    deleteConfig,
    refreshConfigCache,
    clearConfigCache
};
