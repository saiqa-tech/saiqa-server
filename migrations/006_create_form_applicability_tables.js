'use strict';

/**
 * Migration 006: Create Form Applicability Tables
 *
 * Creates two tables that record which designations and tags a specific form
 * requires for a user to be eligible to interact with it:
 *
 *   1. form_applicability_designation_map
 *      — "which job titles may submit/see this form?"
 *      — one row per (form, designation) pair
 *
 *   2. form_applicability_tag_map
 *      — "which tag requirements must a store/user satisfy for this form?"
 *      — one row per (form, tag) pair
 *      — the AND/OR combine logic lives on forms.require_all (checkops forms table)
 *
 * Note: user_effective_scope cache table is NOT created here.
 * It is deferred to saiqa-server/migrations/007_add_scope_cache.js, which is
 * only built at the end of Phase 4 if live scope queries are measurably slow.
 */

const { getClient } = require('../config/database');

async function up() {
  console.log('Running migration 006: Create form applicability tables…');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------------
    // 1. form_applicability_designation_map
    // Records which designations are permitted to interact with a given form.
    // form_id is not FK-constrained (form lives in checkops package / same DB
    // but no cross-package FK by convention).  Application code validates form
    // existence before inserting.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_applicability_designation_map (
        form_id        UUID        NOT NULL,
        designation_id UUID        NOT NULL REFERENCES designations(id) ON DELETE CASCADE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (form_id, designation_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fadm_form_id
        ON form_applicability_designation_map(form_id);
      CREATE INDEX IF NOT EXISTS idx_fadm_designation_id
        ON form_applicability_designation_map(designation_id);
    `);

    // -------------------------------------------------------------------------
    // 2. form_applicability_tag_map
    // Records tag requirements for a form.  The require_all (AND vs OR) logic
    // is stored in forms.require_all (BOOLEAN column) in the checkops forms table.
    // tag_id FK-constrained to tag_definitions (both in saiqa-server schema).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_applicability_tag_map (
        form_id    UUID        NOT NULL,
        tag_id     UUID        NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (form_id, tag_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fatm_form_id
        ON form_applicability_tag_map(form_id);
      CREATE INDEX IF NOT EXISTS idx_fatm_tag_id
        ON form_applicability_tag_map(tag_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 006 completed: form_applicability_designation_map, form_applicability_tag_map created');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 006 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  console.log('Rolling back migration 006: Drop form applicability tables…');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    await client.query('DROP INDEX IF EXISTS idx_fatm_tag_id');
    await client.query('DROP INDEX IF EXISTS idx_fatm_form_id');
    await client.query('DROP TABLE IF EXISTS form_applicability_tag_map CASCADE');

    await client.query('DROP INDEX IF EXISTS idx_fadm_designation_id');
    await client.query('DROP INDEX IF EXISTS idx_fadm_form_id');
    await client.query('DROP TABLE IF EXISTS form_applicability_designation_map CASCADE');

    await client.query('COMMIT');
    console.log('✅ Migration 006 rolled back');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 006 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
