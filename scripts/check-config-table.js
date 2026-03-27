/**
 * Check Config Table Status
 * 
 * This script checks if the config table exists and shows its contents.
 */

require('dotenv').config();
const { query } = require('../config/database');

async function checkConfigTable() {
    console.log('🔍 Checking config table status...\n');

    try {
        // Check if table exists
        const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'config'
      )
    `);

        const tableExists = tableCheck.rows[0].exists;

        if (!tableExists) {
            console.log('❌ Config table does NOT exist');
            console.log('\n📝 To create it, run:');
            console.log('   node scripts/migrate-config-only.js');
            process.exit(0);
        }

        console.log('✅ Config table EXISTS\n');

        // Get table structure
        console.log('📋 Table Structure:');
        const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'config'
      ORDER BY ordinal_position
    `);

        columns.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
        });

        // Get indexes
        console.log('\n🔑 Indexes:');
        const indexes = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'config'
      ORDER BY indexname
    `);

        indexes.rows.forEach(idx => {
            console.log(`   - ${idx.indexname}`);
        });

        // Get row count
        const countResult = await query('SELECT COUNT(*) as count FROM config');
        const count = parseInt(countResult.rows[0].count, 10);

        console.log(`\n📊 Total Rows: ${count}`);

        if (count > 0) {
            // Show all configs
            console.log('\n📄 Current Configurations:');
            const configs = await query('SELECT key, value, category, is_active FROM config ORDER BY category, key');

            configs.rows.forEach(config => {
                const status = config.is_active ? '✅' : '❌';
                console.log(`   ${status} [${config.category}] ${config.key}:`);
                console.log(`      ${JSON.stringify(config.value)}`);
            });
        } else {
            console.log('\n⚠️  Config table is empty. No configurations found.');
            console.log('   This might mean the migration ran but seeding failed.');
            console.log('   Try running: node scripts/migrate-config-only.js');
        }

        console.log('\n✅ Config table check complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error checking config table:', error.message);
        process.exit(1);
    }
}

checkConfigTable();
