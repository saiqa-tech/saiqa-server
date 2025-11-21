const { query, getClient } = require('../config/database');
const bcrypt = require('bcrypt');

async function up() {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Enable UUID extension
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'user')),
        unit_id UUID,
        designation_id UUID,
        is_active BOOLEAN DEFAULT true,
        force_password_change BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        updated_by UUID
      );
    `);
    
    // Create units table
    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        parent_unit_id UUID,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        updated_by UUID,
        FOREIGN KEY (parent_unit_id) REFERENCES units(id) ON DELETE SET NULL
      );
    `);
    
    // Create designations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS designations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        level INTEGER,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        updated_by UUID
      );
    `);
    
    // Add foreign key constraints to users table
    await client.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_users_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_users_designation FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // Add foreign key constraints to units table
    await client.query(`
      ALTER TABLE units
      ADD CONSTRAINT fk_units_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_units_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // Add foreign key constraints to designations table
    await client.query(`
      ALTER TABLE designations
      ADD CONSTRAINT fk_designations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_designations_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    `);
    
    // Create refresh_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    
    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID,
        changes JSONB,
        metadata JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_role ON users(role);
      CREATE INDEX idx_users_unit_id ON users(unit_id);
      CREATE INDEX idx_users_designation_id ON users(designation_id);
      CREATE INDEX idx_users_is_active ON users(is_active);
      CREATE INDEX idx_users_metadata ON users USING GIN(metadata);
      
      CREATE INDEX idx_units_code ON units(code);
      CREATE INDEX idx_units_parent_unit_id ON units(parent_unit_id);
      CREATE INDEX idx_units_is_active ON units(is_active);
      CREATE INDEX idx_units_metadata ON units USING GIN(metadata);
      
      CREATE INDEX idx_designations_code ON designations(code);
      CREATE INDEX idx_designations_level ON designations(level);
      CREATE INDEX idx_designations_is_active ON designations(is_active);
      CREATE INDEX idx_designations_metadata ON designations USING GIN(metadata);
      
      CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
      
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
      CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    `);
    
    // Create trigger function for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    // Create triggers for updated_at
    await client.query(`
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_designations_updated_at BEFORE UPDATE ON designations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    // Seed admin user
    const adminPassword = await bcrypt.hash('Admin@123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, force_password_change)
      VALUES ('admin@saiqa.dev', $1, 'Admin', 'User', 'admin', true, true)
      ON CONFLICT (email) DO NOTHING;
    `, [adminPassword]);
    
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    await client.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
    await client.query('DROP TABLE IF EXISTS refresh_tokens CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    await client.query('DROP TABLE IF EXISTS designations CASCADE;');
    await client.query('DROP TABLE IF EXISTS units CASCADE;');
    await client.query('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;');
    
    await client.query('COMMIT');
    console.log('Rollback completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
