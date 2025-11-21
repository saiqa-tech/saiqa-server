const fs = require('fs');
const path = require('path');
require('dotenv').config();

const migrationsDir = path.join(__dirname, '../migrations');

async function runMigrations() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
  
  console.log('Running migrations...');
  
  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const migration = require(path.join(migrationsDir, file));
    await migration.up();
  }
  
  console.log('All migrations completed');
  process.exit(0);
}

async function rollbackMigrations() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort()
    .reverse();
  
  console.log('Rolling back migrations...');
  
  for (const file of files) {
    console.log(`Rolling back migration: ${file}`);
    const migration = require(path.join(migrationsDir, file));
    await migration.down();
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
