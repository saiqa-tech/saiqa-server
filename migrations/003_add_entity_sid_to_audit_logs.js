/**
 * Migration: Add entity_sid column to audit_logs
 * Purpose: Store human-readable IDs (SID) alongside UUIDs for better debugging
 * Date: 2026-01-28
 */

const { query } = require('../config/database');

async function up() {
    console.log('Running migration: 003_add_entity_sid_to_audit_logs');

    try {
        // Add entity_sid column
        await query(`
            ALTER TABLE audit_logs 
            ADD COLUMN entity_sid VARCHAR(50);
        `);
        console.log('✅ Added entity_sid column to audit_logs');

        // Create index for faster lookups
        await query(`
            CREATE INDEX idx_audit_logs_entity_sid 
            ON audit_logs(entity_sid);
        `);
        console.log('✅ Created index on entity_sid');

        // Add comment for documentation
        await query(`
            COMMENT ON COLUMN audit_logs.entity_sid IS 
            'Human-readable ID (SID) for the entity, e.g., FORM-001, Q-001, SUB-001';
        `);
        console.log('✅ Added column comment');

        console.log('✅ Migration 003 completed successfully');
    } catch (error) {
        console.error('❌ Migration 003 failed:', error);
        throw error;
    }
}

async function down() {
    console.log('Rolling back migration: 003_add_entity_sid_to_audit_logs');

    try {
        // Drop index
        await query(`
            DROP INDEX IF EXISTS idx_audit_logs_entity_sid;
        `);
        console.log('✅ Dropped index idx_audit_logs_entity_sid');

        // Drop column
        await query(`
            ALTER TABLE audit_logs 
            DROP COLUMN IF EXISTS entity_sid;
        `);
        console.log('✅ Dropped entity_sid column');

        console.log('✅ Migration 003 rollback completed');
    } catch (error) {
        console.error('❌ Migration 003 rollback failed:', error);
        throw error;
    }
}

module.exports = { up, down };
