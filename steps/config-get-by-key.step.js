/**
 * Config - Get Configuration by Key Endpoint
 * 
 * Authorization: Admin only
 */

require('dotenv').config();
const { authenticate, adminOnly } = require('../middleware/auth');
const { getConfigWithMetadata } = require('../utils/config');

const config = {
    emits: [],
    name: 'ConfigGetByKey',
    type: 'api',
    path: '/api/config/:key',
    method: 'GET',
    middleware: [authenticate, adminOnly]
};

const handler = async (req, ctx) => {
    try {
        // Safely extract key from params
        const key = req.pathParams?.key;

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
