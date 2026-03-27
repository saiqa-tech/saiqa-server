/**
 * Environment Variables Validation Script
 * Validates all required environment variables for CheckOps integration
 */

require('dotenv').config();

const requiredEnvVars = [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'
];

const checkopsEnvVars = [
    'CHECKOPS_ENABLED', 'CHECKOPS_POOL_MAX'
];

const optionalEnvVars = [
    'CHECKOPS_CACHE_SIZE', 'CHECKOPS_CACHE_TTL', 'CHECKOPS_POOL_MIN',
    'CHECKOPS_MONITORING_ENABLED', 'CHECKOPS_MONITORING_INTERVAL'
];

function validateEnvironment() {
    console.log('Validating environment variables...\n');

    let hasErrors = false;

    // Check required database variables
    console.log('Database Configuration:');
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            console.error(`  ❌ Missing required: ${varName}`);
            hasErrors = true;
        } else {
            const value = varName.includes('PASSWORD') ? '[HIDDEN]' : process.env[varName];
            console.log(`  ✅ ${varName}: ${value}`);
        }
    });

    // Check CheckOps variables
    console.log('\nCheckOps Configuration:');
    checkopsEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            console.error(`  ❌ Missing required: ${varName}`);
            hasErrors = true;
        } else {
            console.log(`  ✅ ${varName}: ${process.env[varName]}`);
        }
    });

    // Check optional variables
    console.log('\nOptional Configuration:');
    optionalEnvVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`  ✅ ${varName}: ${process.env[varName]}`);
        } else {
            console.log(`  ⚪ ${varName}: not set (using default)`);
        }
    });

    // Validate pool allocation
    if (process.env.CHECKOPS_POOL_MAX && process.env.DB_POOL_MAX) {
        const checkopsMax = parseInt(process.env.CHECKOPS_POOL_MAX);
        const totalMax = parseInt(process.env.DB_POOL_MAX);

        console.log('\nConnection Pool Allocation:');
        if (checkopsMax >= totalMax) {
            console.error(`  ❌ CHECKOPS_POOL_MAX (${checkopsMax}) should be less than DB_POOL_MAX (${totalMax})`);
            hasErrors = true;
        } else {
            console.log(`  ✅ CheckOps: ${checkopsMax}, Total: ${totalMax}`);
        }
    }

    if (hasErrors) {
        console.error('\n❌ Environment validation failed');
        process.exit(1);
    }

    console.log('\n✅ All required environment variables present');
}

validateEnvironment();
