/**
 * CheckOps Schema Verification Script
 * Verifies database schema and operations
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');

async function verifySchema() {
    console.log('Verifying CheckOps database schema...\n');

    let checkops;

    try {
        // Check if CheckOps is enabled
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            console.log('⚠️  CheckOps is disabled');
            process.exit(0);
        }

        checkops = getCheckOpsWrapper();
        await checkops.initialize();

        console.log('✓ CheckOps initialized successfully\n');

        // Test database connection
        const health = await checkops.getHealthStatus();
        if (!health.healthy) {
            throw new Error(`CheckOps health check failed: ${health.error || 'Unknown error'}`);
        }
        console.log('✓ CheckOps health check passed');

        // Test basic operations
        console.log('\nTesting table access:');

        try {
            await checkops.getAllForms({ limit: 1 });
            console.log('  ✓ Forms table accessible');
        } catch (error) {
            console.error('  ✗ Forms table issue:', error.message);
            throw error;
        }

        try {
            await checkops.getAllQuestions({ limit: 1 });
            console.log('  ✓ Questions table accessible');
        } catch (error) {
            console.error('  ✗ Questions table issue:', error.message);
            throw error;
        }

        try {
            await checkops.getAllSubmissions({ limit: 1 });
            console.log('  ✓ Submissions table accessible');
        } catch (error) {
            console.error('  ✗ Submissions table issue:', error.message);
            throw error;
        }

        // Test count operations
        console.log('\nTesting count operations:');

        try {
            const formCount = await checkops.getFormCount();
            console.log(`  ✓ Form count: ${formCount}`);
        } catch (error) {
            console.error('  ✗ Form count issue:', error.message);
            throw error;
        }

        try {
            const questionCount = await checkops.getQuestionCount();
            console.log(`  ✓ Question count: ${questionCount}`);
        } catch (error) {
            console.error('  ✗ Question count issue:', error.message);
            throw error;
        }

        try {
            const submissionCount = await checkops.getSubmissionCount();
            console.log(`  ✓ Submission count: ${submissionCount}`);
        } catch (error) {
            console.error('  ✗ Submission count issue:', error.message);
            throw error;
        }

        console.log('\n✅ All CheckOps schema verification checks passed');
        console.log('CheckOps is ready for use');

    } catch (error) {
        console.error('\n❌ CheckOps schema verification failed:', error.message);
        console.error('\nPlease ensure:');
        console.error('  1. CheckOps migrations have been run');
        console.error('  2. Database connection is configured correctly');
        console.error('  3. Required tables exist: forms, questions, submissions');
        process.exit(1);
    } finally {
        if (checkops && checkops.initialized) {
            await checkops.close();
        }
        process.exit(0);
    }
}

verifySchema();
