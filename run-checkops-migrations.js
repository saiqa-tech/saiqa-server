/**
 * Run CheckOps migrations against saiqa_db
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    try {
        console.log('Starting CheckOps database migrations...');
        console.log(`Database: ${process.env.DB_NAME}`);

        const migrationFiles = [
            '001_create_forms_table.sql',
            '002_create_question_bank_table.sql',
            '003_create_submissions_table.sql',
            '004_create_id_counters.sql',
            '005_create_option_history_table.sql',
        ];

        for (const file of migrationFiles) {
            console.log(`\nRunning migration: ${file}`);
            try {
                const filePath = path.join(__dirname, '../checkops/migrations', file);
                const sql = fs.readFileSync(filePath, 'utf8');
                await pool.query(sql);
                console.log(`✓ Completed: ${file}`);
            } catch (error) {
                if (error.code === '42710' || error.message.includes('already exists')) {
                    console.log(`⚠ Skipped: ${file} (already exists)`);
                } else {
                    console.error(`❌ Failed: ${file}`, error.message);
                    throw error;
                }
            }
        }

        console.log('\n✅ All migrations completed successfully!');

        // Verify tables were created
        console.log('\nVerifying tables...');
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('forms', 'question_bank', 'submissions', 'id_counters', 'question_option_history')
            ORDER BY table_name
        `);

        console.log('Created tables:', result.rows.map(r => r.table_name));

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();