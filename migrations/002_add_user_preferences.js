const { getClient } = require('../config/database');

async function up() {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN(preferences);
    `);
    
    await client.query('COMMIT');
    console.log('Migration 002_add_user_preferences completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 002_add_user_preferences failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    await client.query(`
      DROP INDEX IF EXISTS idx_users_preferences;
    `);
    
    await client.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS preferences;
    `);
    
    await client.query('COMMIT');
    console.log('Rollback 002_add_user_preferences completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback 002_add_user_preferences failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
