/**
 * Config - Get All Configurations Endpoint
 * 
 * Authorization: Admin only
 */

require('dotenv').config();
const { getAllConfigs } = require('../utils/config');

const config = {
    emits: [],
    name: 'ConfigGetAll',
    type: 'api',
    path: '/api/config',
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

        const configs = await getAllConfigs();

        return {
            status: 200,
            body: {
                success: true,
                data: configs,
                total: configs.length
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
