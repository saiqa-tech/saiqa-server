const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { query, getClient } = require('../config/database');

const migrationsDir = path.join(__dirname, '../migrations');

/**
 * Ensure the schema_migrations tracking table exists.
 * This table records which migration files have already been applied so that
 * the runner never re-executes a migration that succeeded previously.
 */
async function ensureTrackingTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations() {
  const res = await query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(res.rows.map(r => r.filename));
}

async function recordMigration(filename) {
  await query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
    [filename]
  );
}

async function removeMigrationRecord(filename) {
  await query('DELETE FROM schema_migrations WHERE filename = $1', [filename]);
}

async function runMigrations() {
  await ensureTrackingTable();
  const applied = await appliedMigrations();

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('All migrations are already up to date.');
    process.exit(0);
  }

  console.log(`Running ${pending.length} pending migration(s)…`);

  for (const file of pending) {
    console.log(`  → ${file}`);
    const migration = require(path.join(migrationsDir, file));
    await migration.up();
    await recordMigration(file);
    console.log(`  ✓ ${file} applied`);
  }

  console.log('All migrations completed');
  process.exit(0);
}

async function rollbackMigrations() {
  await ensureTrackingTable();
  const applied = await appliedMigrations();

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') && applied.has(f))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('Nothing to roll back.');
    process.exit(0);
  }

  console.log(`Rolling back ${files.length} migration(s)…`);

  for (const file of files) {
    console.log(`  → ${file}`);
    const migration = require(path.join(migrationsDir, file));
    await migration.down();
    await removeMigrationRecord(file);
    console.log(`  ✓ ${file} rolled back`);
  }

  console.log('All migrations rolled back');
  process.exit(0);
}

const command = process.argv[2];

if (command === 'up') {
  runMigrations().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
} else if (command === 'down') {
  rollbackMigrations().catch(err => {
    console.error('Rollback failed:', err);
    process.exit(1);
  });
} else {
  console.log('Usage: node scripts/migrate.js [up|down]');
  process.exit(1);
}
