'use strict';

/**
 * Migration 005: Create Visibility Foundation Tables
 *
 * Creates the three tables that underpin the SAIQA Visibility System:
 *   1. tag_definitions  — master catalog of all tags (category + value pairs)
 *   2. entity_tag_map   — assigns tags to units or users (unified entity model)
 *   3. designation_permissions — per-designation capability rules (allow/deny + scope)
 *
 * Also seeds 15 standard tag definitions and default permission rules.
 *
 * ⚠️  Pre-flight check before running this migration:
 *     SELECT id, title, code FROM designations;
 *     Verify rows exist and every row has a non-null `code` matching the seed
 *     values below (STORE_EMP, REGIONAL_MGR, ADMIN).  If not, populate
 *     designations first — otherwise the permission seed will silently insert
 *     zero rows and every action will be denied by default.
 */

const { getClient } = require('../config/database');

async function up() {
  console.log('Running migration 005: Create visibility foundation tables…');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------------
    // 1. tag_definitions
    // Master catalog: every tag that can be applied to a unit or user must exist
    // here first.  No FK from entity_tag_map is possible without this table.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS tag_definitions (
        id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
        category   VARCHAR(50)  NOT NULL,
        value      VARCHAR(100) NOT NULL,
        label      VARCHAR(150) NOT NULL,
        is_active  BOOLEAN      NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE (category, value)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tag_definitions_category
        ON tag_definitions(category);
      CREATE INDEX IF NOT EXISTS idx_tag_definitions_is_active
        ON tag_definitions(is_active);
    `);

    // Seed: 15 standard SAIQA tags (Business_Unit × 3, Countries × 4,
    // Region × 3, Function × 5).  ON CONFLICT = safe to re-run.
    await client.query(`
      INSERT INTO tag_definitions (category, value, label) VALUES
        ('Business_Unit', 'SSS',            'SSS Brand'),
        ('Business_Unit', 'KFC',            'KFC Brand'),
        ('Business_Unit', 'Starbucks',      'Starbucks Brand'),
        ('Countries',     'UAE',            'United Arab Emirates'),
        ('Countries',     'KSA',            'Kingdom of Saudi Arabia'),
        ('Countries',     'Qatar',          'Qatar'),
        ('Countries',     'Kuwait',         'Kuwait'),
        ('Region',        'Region_X',       'Region X'),
        ('Region',        'Region_Y',       'Region Y'),
        ('Region',        'Region_Z',       'Region Z'),
        ('Function',      'Operations',     'Operations'),
        ('Function',      'Maintenance',    'Maintenance'),
        ('Function',      'Training',       'Training'),
        ('Function',      'Safety',         'Safety'),
        ('Function',      'Quality_Control','Quality Control')
      ON CONFLICT (category, value) DO NOTHING;
    `);

    // -------------------------------------------------------------------------
    // 2. entity_tag_map
    // Assignment table: one row = one tag applied to one entity (unit or user).
    // No SQL FK on entity_id because it can reference either units.id or users.id
    // — enforced in application code instead.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_tag_map (
        entity_id   UUID        NOT NULL,
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('unit', 'user')),
        tag_id      UUID        NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        assigned_by UUID,
        PRIMARY KEY (entity_id, entity_type, tag_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_tag_map_entity
        ON entity_tag_map(entity_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_entity_tag_map_tag_id
        ON entity_tag_map(tag_id);
    `);

    // -------------------------------------------------------------------------
    // 3. designation_permissions
    // Per-designation capability rules.  One row = one (designation, action)
    // combination.  Missing row = denied by default (deny-by-default model).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS designation_permissions (
        id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        designation_id UUID        NOT NULL REFERENCES designations(id) ON DELETE CASCADE,
        action         VARCHAR(50) NOT NULL CHECK (action IN (
                         'SUBMIT_FORM', 'VIEW_SUBMISSION', 'VIEW_FINDING',
                         'UPDATE_FINDING', 'VIEW_REPORT', 'MANAGE_FORM'
                       )),
        allowed        BOOLEAN     NOT NULL,
        scope_type     VARCHAR(20) NOT NULL CHECK (scope_type IN ('own', 'scoped')),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (designation_id, action)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_designation_permissions_designation_id
        ON designation_permissions(designation_id);
    `);

    // Seed: default permission rules.
    // Uses INSERT … SELECT with a VALUES cross-join so that if a designation
    // with a given code does not exist, no row is inserted (silent, safe).
    // Codes used: STORE_EMP, AR_MGR, REGIONAL_MGR, ADMIN
    await client.query(`
      INSERT INTO designation_permissions (designation_id, action, allowed, scope_type)
      SELECT d.id, v.action, v.allowed, v.scope_type
      FROM designations d
      CROSS JOIN (VALUES
        ('STORE_EMP',    'SUBMIT_FORM',     true,  'own'),
        ('STORE_EMP',    'VIEW_SUBMISSION',  true,  'own'),
        ('STORE_EMP',    'VIEW_FINDING',     true,  'own'),
        ('STORE_EMP',    'UPDATE_FINDING',   false, 'own'),
        ('STORE_EMP',    'VIEW_REPORT',      false, 'own'),
        ('AR_MGR',       'SUBMIT_FORM',      true,  'scoped'),
        ('AR_MGR',       'VIEW_SUBMISSION',  true,  'scoped'),
        ('AR_MGR',       'VIEW_FINDING',     true,  'scoped'),
        ('AR_MGR',       'UPDATE_FINDING',   true,  'scoped'),
        ('AR_MGR',       'VIEW_REPORT',      true,  'scoped'),
        ('REGIONAL_MGR', 'SUBMIT_FORM',      true,  'scoped'),
        ('REGIONAL_MGR', 'VIEW_SUBMISSION',  true,  'scoped'),
        ('REGIONAL_MGR', 'VIEW_FINDING',     true,  'scoped'),
        ('REGIONAL_MGR', 'UPDATE_FINDING',   true,  'scoped'),
        ('REGIONAL_MGR', 'VIEW_REPORT',      true,  'scoped'),
        ('ADMIN',        'MANAGE_FORM',      true,  'scoped')
      ) AS v(code, action, allowed, scope_type)
      WHERE d.code = v.code
      ON CONFLICT (designation_id, action) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 005 completed: tag_definitions, entity_tag_map, designation_permissions created and seeded');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 005 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  console.log('Rolling back migration 005: Drop visibility foundation tables…');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Drop in reverse dependency order
    await client.query('DROP INDEX IF EXISTS idx_designation_permissions_designation_id');
    await client.query('DROP TABLE IF EXISTS designation_permissions CASCADE');

    await client.query('DROP INDEX IF EXISTS idx_entity_tag_map_tag_id');
    await client.query('DROP INDEX IF EXISTS idx_entity_tag_map_entity');
    await client.query('DROP TABLE IF EXISTS entity_tag_map CASCADE');

    await client.query('DROP INDEX IF EXISTS idx_tag_definitions_is_active');
    await client.query('DROP INDEX IF EXISTS idx_tag_definitions_category');
    await client.query('DROP TABLE IF EXISTS tag_definitions CASCADE');

    await client.query('COMMIT');
    console.log('✅ Migration 005 rolled back');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 005 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
