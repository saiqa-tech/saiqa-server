/**
 * Migration 004: Create Config Table
 * 
 * Creates a flexible configuration table for storing application settings
 * including finding validation rules, system preferences, etc.
 */

const { query } = require('../config/database');

async function up() {
    console.log('Running migration 004: Create config table...');

    // Create config table
    await query(`
    CREATE TABLE IF NOT EXISTS config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(100) UNIQUE NOT NULL,
      value JSONB NOT NULL,
      description TEXT,
      category VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by VARCHAR(100),
      updated_by VARCHAR(100)
    )
  `);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_config_key ON config(key)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_config_category ON config(category)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_config_is_active ON config(is_active)`);

    // Seed default finding configurations
    await query(`
    INSERT INTO config (key, value, description, category, created_by) VALUES
    (
      'finding_severities',
      '["Minor", "Major", "Critical"]',
      'Allowed severity levels for findings',
      'findings',
      'system'
    ),
    (
      'finding_departments',
      '["Operations", "Maintenance", "Training", "Equipment", "Safety", "Quality Control"]',
      'Allowed departments for findings',
      'findings',
      'system'
    ),
    (
      'finding_statuses',
      '["open", "in_progress", "resolved", "closed"]',
      'Allowed status values for findings',
      'findings',
      'system'
    )
    ON CONFLICT (key) DO NOTHING
  `);

    console.log('✅ Migration 004 completed: Config table created and seeded');
}

async function down() {
    console.log('Rolling back migration 004: Drop config table...');

    await query(`DROP INDEX IF EXISTS idx_config_is_active`);
    await query(`DROP INDEX IF EXISTS idx_config_category`);
    await query(`DROP INDEX IF EXISTS idx_config_key`);
    await query(`DROP TABLE IF EXISTS config CASCADE`);

    console.log('✅ Migration 004 rolled back: Config table dropped');
}

module.exports = { up, down };
