/**
 * CheckOps Setup Script
 * Initializes and verifies CheckOps integration
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

async function setupCheckOps() {
    try {
        console.log('Setting up CheckOps...\n');

        // Check if CheckOps is enabled
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            console.log('⚠️  CheckOps is disabled (CHECKOPS_ENABLED !== true)');
            console.log('   Set CHECKOPS_ENABLED=true in .env to enable');
            process.exit(0);
        }

        // Initialize CheckOps wrapper
        const checkopsWrapper = getCheckOpsWrapper();
        await checkopsWrapper.initialize();

        console.log('✅ CheckOps initialized successfully\n');

        // Test basic operations
        console.log('Testing CheckOps operations...');

        // Test form operations
        try {
            await checkopsWrapper.getAllForms({ limit: 1 });
            console.log('  ✅ Forms table accessible');
        } catch (error) {
            console.error('  ❌ Forms table issue:', error.message);
        }

        // Test question operations
        try {
            await checkopsWrapper.getAllQuestions({ limit: 1 });
            console.log('  ✅ Questions table accessible');
        } catch (error) {
            console.error('  ❌ Questions table issue:', error.message);
        }

        // Test submission operations
        try {
            await checkopsWrapper.getAllSubmissions({ limit: 1 });
            console.log('  ✅ Submissions table accessible');
        } catch (error) {
            console.error('  ❌ Submissions table issue:', error.message);
        }

        // Get health status
        const health = await checkopsWrapper.getHealthStatus();
        console.log('\nHealth Status:', health.healthy ? '✅ Healthy' : '❌ Unhealthy');

        // Get metrics
        const metrics = checkopsWrapper.getMetrics();
        console.log('\nMetrics:');
        console.log('  Operations:', metrics.operations);
        console.log('  Errors:', metrics.errors);
        console.log('  Initialized:', metrics.initialized);

        // Close connection
        await checkopsWrapper.close();

        console.log('\n✅ CheckOps setup completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ CheckOps setup failed:', error.message);
        console.error('\nPossible causes:');
        console.error('  - Database connection issues');
        console.error('  - CheckOps tables not created (run migrations)');
        console.error('  - Invalid environment configuration');
        process.exit(1);
    }
}

setupCheckOps();
