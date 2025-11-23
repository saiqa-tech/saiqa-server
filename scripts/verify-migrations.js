#!/usr/bin/env node

/**
 * Database Migration Verification Script
 * 
 * This script verifies that all database migrations have been executed
 * and the database schema matches the expected state.
 */

const { query, getClient } = require('../config/database');

async function verifyMigrations() {
  console.log('🔍 Starting database migration verification...\n');
  
  const checks = [];
  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;

  try {
    // Check 1: UUID extension
    console.log('1️⃣  Checking UUID extension...');
    totalChecks++;
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
        ) as exists;
      `);
      if (result.rows[0].exists) {
        console.log('   ✅ UUID extension enabled\n');
        passedChecks++;
        checks.push({ name: 'UUID Extension', status: 'PASS' });
      } else {
        console.log('   ❌ UUID extension not found\n');
        failedChecks++;
        checks.push({ name: 'UUID Extension', status: 'FAIL', error: 'Extension not installed' });
      }
    } catch (error) {
      console.log(`   ❌ Error checking UUID extension: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'UUID Extension', status: 'FAIL', error: error.message });
    }

    // Check 2: Tables existence
    console.log('2️⃣  Checking required tables...');
    totalChecks++;
    const requiredTables = ['users', 'units', 'designations', 'refresh_tokens', 'audit_logs'];
    try {
      const result = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1::text[]);
      `, [requiredTables]);
      
      const foundTables = result.rows.map(r => r.table_name);
      const missingTables = requiredTables.filter(t => !foundTables.includes(t));
      
      if (missingTables.length === 0) {
        console.log('   ✅ All required tables exist');
        console.log(`   Tables: ${foundTables.join(', ')}\n`);
        passedChecks++;
        checks.push({ name: 'Required Tables', status: 'PASS', tables: foundTables });
      } else {
        console.log(`   ❌ Missing tables: ${missingTables.join(', ')}\n`);
        failedChecks++;
        checks.push({ name: 'Required Tables', status: 'FAIL', missing: missingTables });
      }
    } catch (error) {
      console.log(`   ❌ Error checking tables: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'Required Tables', status: 'FAIL', error: error.message });
    }

    // Check 3: Users table structure
    console.log('3️⃣  Checking users table structure...');
    totalChecks++;
    try {
      const result = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      
      const requiredColumns = [
        'id', 'email', 'password_hash', 'first_name', 'last_name', 'role',
        'unit_id', 'designation_id', 'is_active', 'force_password_change',
        'metadata', 'created_at', 'updated_at', 'created_by', 'updated_by'
      ];
      
      const foundColumns = result.rows.map(r => r.column_name);
      const missingColumns = requiredColumns.filter(c => !foundColumns.includes(c));
      
      if (missingColumns.length === 0) {
        console.log('   ✅ Users table has all required columns\n');
        passedChecks++;
        checks.push({ name: 'Users Table Structure', status: 'PASS' });
      } else {
        console.log(`   ❌ Users table missing columns: ${missingColumns.join(', ')}\n`);
        failedChecks++;
        checks.push({ name: 'Users Table Structure', status: 'FAIL', missing: missingColumns });
      }
    } catch (error) {
      console.log(`   ❌ Error checking users table: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'Users Table Structure', status: 'FAIL', error: error.message });
    }

    // Check 4: Indexes
    console.log('4️⃣  Checking database indexes...');
    totalChecks++;
    try {
      const result = await query(`
        SELECT tablename, indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        AND tablename IN ('users', 'units', 'designations', 'refresh_tokens', 'audit_logs');
      `);
      
      const indexCount = result.rows.length;
      if (indexCount > 0) {
        console.log(`   ✅ Found ${indexCount} indexes\n`);
        passedChecks++;
        checks.push({ name: 'Database Indexes', status: 'PASS', count: indexCount });
      } else {
        console.log('   ⚠️  No indexes found (may impact performance)\n');
        failedChecks++;
        checks.push({ name: 'Database Indexes', status: 'WARN', count: 0 });
      }
    } catch (error) {
      console.log(`   ❌ Error checking indexes: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'Database Indexes', status: 'FAIL', error: error.message });
    }

    // Check 5: Foreign key constraints
    console.log('5️⃣  Checking foreign key constraints...');
    totalChecks++;
    try {
      const result = await query(`
        SELECT
          tc.table_name,
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
      `);
      
      const fkCount = result.rows.length;
      if (fkCount > 0) {
        console.log(`   ✅ Found ${fkCount} foreign key constraints\n`);
        passedChecks++;
        checks.push({ name: 'Foreign Key Constraints', status: 'PASS', count: fkCount });
      } else {
        console.log('   ⚠️  No foreign key constraints found\n');
        failedChecks++;
        checks.push({ name: 'Foreign Key Constraints', status: 'WARN', count: 0 });
      }
    } catch (error) {
      console.log(`   ❌ Error checking foreign keys: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'Foreign Key Constraints', status: 'FAIL', error: error.message });
    }

    // Check 6: Triggers
    console.log('6️⃣  Checking database triggers...');
    totalChecks++;
    try {
      const result = await query(`
        SELECT event_object_table, trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        AND trigger_name LIKE '%updated_at%';
      `);
      
      const triggerCount = result.rows.length;
      if (triggerCount >= 3) {
        console.log(`   ✅ Found ${triggerCount} updated_at triggers\n`);
        passedChecks++;
        checks.push({ name: 'Database Triggers', status: 'PASS', count: triggerCount });
      } else {
        console.log(`   ⚠️  Expected at least 3 updated_at triggers, found ${triggerCount}\n`);
        failedChecks++;
        checks.push({ name: 'Database Triggers', status: 'WARN', count: triggerCount });
      }
    } catch (error) {
      console.log(`   ❌ Error checking triggers: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'Database Triggers', status: 'FAIL', error: error.message });
    }

    // Check 7: Admin user exists
    console.log('7️⃣  Checking admin user...');
    totalChecks++;
    try {
      const result = await query(`
        SELECT id, email, role, is_active 
        FROM users 
        WHERE role = 'admin' AND is_active = true
        LIMIT 1;
      `);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ Admin user found: ${result.rows[0].email}\n`);
        passedChecks++;
        checks.push({ name: 'Admin User', status: 'PASS', email: result.rows[0].email });
      } else {
        console.log('   ❌ No active admin user found\n');
        failedChecks++;
        checks.push({ name: 'Admin User', status: 'FAIL', error: 'No admin user' });
      }
    } catch (error) {
      console.log(`   ❌ Error checking admin user: ${error.message}\n`);
      failedChecks++;
      checks.push({ name: 'Admin User', status: 'FAIL', error: error.message });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`✅ Passed: ${passedChecks}`);
    console.log(`❌ Failed: ${failedChecks}`);
    console.log('='.repeat(60) + '\n');

    if (failedChecks === 0) {
      console.log('🎉 All migration checks passed! Database is ready.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some checks failed. Please review the migration status.\n');
      console.log('💡 Run migration script: npm run migrate\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Fatal error during verification:', error);
    process.exit(1);
  }
}

// Run verification
verifyMigrations().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
