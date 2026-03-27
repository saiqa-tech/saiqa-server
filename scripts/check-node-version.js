/**
 * Node.js Version Check Script
 * CheckOps v3.0.0 requires Node.js >= 24.0.0
 */

const semver = require('semver');

function checkNodeVersion() {
    const currentVersion = process.version;
    const requiredVersion = '>=24.0.0'; // CheckOps requirement

    console.log(`Current Node.js version: ${currentVersion}`);
    console.log(`Required Node.js version: ${requiredVersion}`);

    if (!semver.satisfies(currentVersion, requiredVersion)) {
        console.error(`❌ Node.js version ${currentVersion} is not supported.`);
        console.error(`   CheckOps requires Node.js ${requiredVersion}`);
        console.error(`   Please upgrade Node.js and try again.`);
        process.exit(1);
    }

    console.log('✅ Node.js version is compatible');
}

checkNodeVersion();
