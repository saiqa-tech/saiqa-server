/**
 * Direct API Test - Bypasses HTTP and calls handler directly
 */

require('dotenv').config();

async function testAllowedValuesEndpoint() {
    console.log('🧪 Testing Allowed Values Endpoint Directly...\n');

    try {
        // Load the endpoint handler
        const endpoint = require('./steps/checkops-findings-allowed-values.step.js');

        console.log('✅ Endpoint loaded');
        console.log('   Path:', endpoint.config.path);
        console.log('   Method:', endpoint.config.method);
        console.log('   Name:', endpoint.config.name);

        // Create mock request and context
        const mockReq = {
            params: {},
            query: {},
            body: {},
            headers: {},
            user: null
        };

        const mockCtx = {
            logger: console
        };

        console.log('\n📡 Calling handler...\n');

        // Call the handler
        const response = await endpoint.handler(mockReq, mockCtx);

        console.log('📊 Response:');
        console.log('   Status:', response.status);
        console.log('   Body:', JSON.stringify(response.body, null, 2));

        if (response.status === 200) {
            console.log('\n✅ SUCCESS! Endpoint is working correctly.');
        } else {
            console.log('\n⚠️  Unexpected status code:', response.status);
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testAllowedValuesEndpoint();
