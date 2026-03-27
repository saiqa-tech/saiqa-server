/**
 * Run Config Migration Only (004)
 * 
 * This script runs only the config table migration,
 * skipping previously run migrations.
 */

require('dotenv').config();
const path = require('path');

async function runConfigMigration() {
    console.log('Running config migration (004)...');

    try {
        const migration = require(path.join(__dirname, '../migrations/004_create_config_table.js'));
        await migration.up();

        console.log('✅ Config migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Config migration failed:', error.message);

        // Check if it's a "table already exists" error
        if (error.message && error.message.includes('already exists')) {
            console.log('\n⚠️  Config table already exists. This is OK if you ran this migration before.');
            console.log('   You can verify with: psql -d saiqa -c "SELECT * FROM config"');
            process.exit(0);
        }

        process.exit(1);
    }
}

runConfigMigration();
