/**
 * Config - Get Configuration by Key Endpoint
 * 
 * Authorization: Admin only
 */

require('dotenv').config();
const { getConfigWithMetadata } = require('../utils/config');

const config = {
    emits: [],
    name: 'ConfigGetByKey',
    type: 'api',
    path: '/api/config/:key',
    method: 'GET'
};

const handler = async (req, ctx) => {
    try {
        // Authorization: Admin only
        if (!req.user || req.user.role !== 'admin') {
            return {
                status: 403,
                body: { error: 'Insufficient permissions. Admin access required.' }
            };
        }

        // Safely extract key from params
        const key = req.params?.key;

        if (!key) {
            return {
                status: 400,
                body: { error: 'Config key is required' }
            };
        }

        const configData = await getConfigWithMetadata(key);

        if (!configData) {
            return {
                status: 404,
                body: { error: 'Configuration not found' }
            };
        }

        return {
            status: 200,
            body: {
                success: true,
                data: configData
            }
        };
    } catch (error) {
        console.error('Config retrieval failed:', error);
        return {
            status: 500,
            body: {
                error: 'Config retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
