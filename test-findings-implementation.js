/**
 * Test Script for Findings Implementation
 * 
 * This script tests the findings feature implementation
 * Run with: node test-findings-implementation.js
 */

require('dotenv').config();
const { query } = require('./config/database');
const { initializeConfigCache, getConfig, getAllConfigs } = require('./utils/config');
const { validateFindingData, getAllowedFindingValues } = require('./lib/checkops-finding-validator');

async function testConfigTable() {
    console.log('\n📋 Testing Config Table...');

    try {
        // Check if table exists
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'config'
            )
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('❌ Config table does not exist. Run migration first: npm run migrate:up');
            return false;
        }

        console.log('✅ Config table exists');

        // Check seeded data
        const configs = await query('SELECT key, value FROM config WHERE category = $1', ['findings']);
        console.log(`✅ Found ${configs.rows.length} finding configs:`);
        configs.rows.forEach(row => {
            console.log(`   - ${row.key}: ${JSON.stringify(row.value)}`);
        });

        return true;
    } catch (error) {
        console.error('❌ Config table test failed:', error.message);
        return false;
    }
}

async function testConfigCache() {
    console.log('\n🗄️  Testing Config Cache...');

    try {
        await initializeConfigCache();
        console.log('✅ Config cache initialized');

        const severities = await getConfig('finding_severities');
        console.log('✅ Retrieved severities:', severities);

        const departments = await getConfig('finding_departments');
        console.log('✅ Retrieved departments:', departments);

        const statuses = await getConfig('finding_statuses');
        console.log('✅ Retrieved statuses:', statuses);

        return true;
    } catch (error) {
        console.error('❌ Config cache test failed:', error.message);
        return false;
    }
}

async function testValidation() {
    console.log('\n✔️  Testing Validation...');

    try {
        // Test valid data
        const validData = {
            submissionId: 'SUB-001',
            questionId: 'Q-001',
            formId: 'FORM-001',
            severity: 'Major',
            department: 'Operations',
            observation: 'Test observation',
            status: 'open'
        };

        const validErrors = await validateFindingData(validData);
        if (validErrors.length === 0) {
            console.log('✅ Valid data passed validation');
        } else {
            console.log('❌ Valid data failed validation:', validErrors);
            return false;
        }

        // Test invalid severity
        const invalidSeverity = {
            ...validData,
            severity: 'Super Critical' // Not in allowed list
        };

        const severityErrors = await validateFindingData(invalidSeverity);
        if (severityErrors.some(e => e.includes('severity must be one of'))) {
            console.log('✅ Invalid severity correctly rejected');
        } else {
            console.log('❌ Invalid severity not caught:', severityErrors);
            return false;
        }

        // Test missing required field
        const missingObservation = {
            ...validData,
            observation: undefined
        };

        const missingErrors = await validateFindingData(missingObservation);
        if (missingErrors.some(e => e.includes('observation is required'))) {
            console.log('✅ Missing required field correctly rejected');
        } else {
            console.log('❌ Missing required field not caught:', missingErrors);
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ Validation test failed:', error.message);
        return false;
    }
}

async function testAllowedValues() {
    console.log('\n📝 Testing Allowed Values...');

    try {
        const allowedValues = await getAllowedFindingValues();

        console.log('✅ Allowed severities:', allowedValues.severities);
        console.log('✅ Allowed departments:', allowedValues.departments);
        console.log('✅ Allowed statuses:', allowedValues.statuses);

        return true;
    } catch (error) {
        console.error('❌ Allowed values test failed:', error.message);
        return false;
    }
}

async function testCheckOpsWrapper() {
    console.log('\n🔧 Testing CheckOps Wrapper...');

    try {
        const { getCheckOpsWrapper } = require('./lib/checkops-wrapper');
        const wrapper = getCheckOpsWrapper();

        // Check if finding methods exist
        const methods = [
            'createFinding',
            'getFinding',
            'getFindingsByForm',
            'getFindingsBySubmission',
            'getFindingsByQuestion',
            'getFindings',
            'updateFinding',
            'deleteFinding',
            'getFindingCount'
        ];

        let allMethodsExist = true;
        methods.forEach(method => {
            if (typeof wrapper[method] === 'function') {
                console.log(`✅ Method exists: ${method}`);
            } else {
                console.log(`❌ Method missing: ${method}`);
                allMethodsExist = false;
            }
        });

        return allMethodsExist;
    } catch (error) {
        console.error('❌ CheckOps wrapper test failed:', error.message);
        return false;
    }
}

async function testEndpointFiles() {
    console.log('\n📁 Testing Endpoint Files...');

    const fs = require('fs');
    const path = require('path');

    const endpoints = [
        'checkops-findings-create.step.js',
        'checkops-findings-get.step.js',
        'checkops-findings-list.step.js',
        'checkops-findings-update.step.js',
        'checkops-findings-delete.step.js',
        'checkops-findings-stats.step.js',
        'checkops-findings-allowed-values.step.js',
        'config-get-all.step.js',
        'config-get-by-key.step.js'
    ];

    let allFilesExist = true;
    endpoints.forEach(file => {
        const filePath = path.join(__dirname, 'steps', file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ Endpoint file exists: ${file}`);
        } else {
            console.log(`❌ Endpoint file missing: ${file}`);
            allFilesExist = false;
        }
    });

    return allFilesExist;
}

async function runAllTests() {
    console.log('🧪 Starting Findings Implementation Tests...');
    console.log('='.repeat(60));

    const results = {
        configTable: await testConfigTable(),
        configCache: await testConfigCache(),
        validation: await testValidation(),
        allowedValues: await testAllowedValues(),
        checkopsWrapper: await testCheckOpsWrapper(),
        endpointFiles: await testEndpointFiles()
    };

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary:');
    console.log('='.repeat(60));

    Object.entries(results).forEach(([test, passed]) => {
        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const allPassed = Object.values(results).every(r => r === true);

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
        console.log('🎉 All tests PASSED! Implementation is ready.');
        console.log('\nNext steps:');
        console.log('1. Start the server: npm start');
        console.log('2. Test the API endpoints with curl or Postman');
        console.log('3. Check the audit logs in the database');
    } else {
        console.log('⚠️  Some tests FAILED. Please review the errors above.');
        console.log('\nCommon issues:');
        console.log('- Config table not created: Run npm run migrate:up');
        console.log('- Database connection: Check .env file');
        console.log('- Missing files: Check file paths');
    }
    console.log('='.repeat(60));

    process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
});
