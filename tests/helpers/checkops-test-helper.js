/**
 * CheckOps Test Helper
 * Utilities for testing CheckOps v4.0.0 integration
 */

const { query } = require('../../config/database');

/**
 * Deletes all CheckOps data from the database
 * Use before each test to ensure clean state
 */
async function cleanCheckOpsData() {
    console.log('🧹 Cleaning CheckOps data...');

    try {
        // Delete in correct order (respecting foreign keys)
        await query('DELETE FROM submissions');
        await query('DELETE FROM forms');
        await query('DELETE FROM question_bank');
        await query('DELETE FROM question_option_history');

        // Reset SID counters
        await query("UPDATE sid_counters SET counter = 0, updated_at = CURRENT_TIMESTAMP");

        console.log('✅ CheckOps data cleaned');

        // Verify cleanup
        const counts = await query(`
            SELECT 
                (SELECT COUNT(*) FROM forms) as forms,
                (SELECT COUNT(*) FROM question_bank) as questions,
                (SELECT COUNT(*) FROM submissions) as submissions
        `);

        console.log('   Remaining records:', counts.rows[0]);

        return counts.rows[0];
    } catch (error) {
        console.error('❌ Failed to clean CheckOps data:', error);
        throw error;
    }
}

/**
 * Verifies audit log entry exists
 */
async function verifyAuditLog(entityId, action) {
    const result = await query(
        'SELECT * FROM audit_logs WHERE entity_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1',
        [entityId, action]
    );

    return result.rows[0];
}

/**
 * Gets all audit logs for an entity
 */
async function getAuditLogs(entityId) {
    const result = await query(
        'SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at DESC',
        [entityId]
    );

    return result.rows;
}

/**
 * Verifies database structure for v4.0.0
 */
async function verifyV4Structure() {
    console.log('🔍 Verifying v4.0.0 database structure...');

    const checks = [];

    // Check forms table has id (UUID) and sid (VARCHAR)
    const formsColumns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'forms' AND column_name IN ('id', 'sid')
    `);
    checks.push({
        name: 'forms table structure',
        passed: formsColumns.rows.length === 2
    });

    // Check question_bank table
    const questionsColumns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'question_bank' AND column_name IN ('id', 'sid')
    `);
    checks.push({
        name: 'question_bank table structure',
        passed: questionsColumns.rows.length === 2
    });

    // Check submissions table
    const submissionsColumns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'submissions' AND column_name IN ('id', 'sid', 'form_sid')
    `);
    checks.push({
        name: 'submissions table structure',
        passed: submissionsColumns.rows.length === 3
    });

    // Check sid_counters table exists
    const sidCounters = await query(`
        SELECT COUNT(*) as count FROM sid_counters
    `);
    checks.push({
        name: 'sid_counters table',
        passed: parseInt(sidCounters.rows[0].count) === 3
    });

    // Check audit_logs has entity_sid column
    const auditColumns = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'entity_sid'
    `);
    checks.push({
        name: 'audit_logs entity_sid column',
        passed: auditColumns.rows.length === 1
    });

    const allPassed = checks.every(c => c.passed);

    checks.forEach(check => {
        console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`);
    });

    if (!allPassed) {
        throw new Error('v4.0.0 database structure verification failed');
    }

    console.log('✅ v4.0.0 database structure verified');
    return true;
}

module.exports = {
    cleanCheckOpsData,
    verifyAuditLog,
    getAuditLogs,
    verifyV4Structure
};
