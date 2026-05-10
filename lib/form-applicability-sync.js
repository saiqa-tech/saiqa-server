'use strict';

/**
 * form-applicability-sync.js
 *
 * Keeps form_applicability_designation_map and form_applicability_tag_map in
 * sync with the visibility configuration of a form.
 *
 * Call this every time a form is created or updated.
 *
 * Input shape (visibilityConfig from req.body.visibility):
 * {
 *   require_all: true,                          // stored in checkops forms.require_all (BOOLEAN)
 *   allowedDesignationIds: ["uuid-1", "uuid-2"], // stored here in saiqa-server
 *   requiresTags: [                              // stored here in saiqa-server
 *     { category: "Business_Unit", value: "SSS" },
 *     { category: "Countries",     value: "UAE" }
 *   ]
 * }
 *
 * If visibilityConfig is {} or has no allowedDesignationIds / requiresTags,
 * the form reverts to "open to everyone" (no rows in either table).
 */

const { query, getClient } = require('../config/database');

/**
 * Synchronise form applicability tables for a given form.
 *
 * @param {string} formId          - UUID of the form (from checkops)
 * @param {object} visibilityConfig - Full visibility object from req.body.visibility
 *                                    May be {} or absent — treated as no restrictions.
 */
async function syncFormApplicability(formId, visibilityConfig = {}) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // -----------------------------------------------------------------------
        // Step A: Clear all old rules for this form (start fresh every save).
        // -----------------------------------------------------------------------
        await client.query(
            'DELETE FROM form_applicability_designation_map WHERE form_id = $1',
            [formId]
        );
        await client.query(
            'DELETE FROM form_applicability_tag_map WHERE form_id = $1',
            [formId]
        );

        // -----------------------------------------------------------------------
        // Step B: Write designation rules.
        // Only write rows when allowedDesignationIds is a non-empty array.
        // Empty / absent = no designation restriction (all allowed).
        // -----------------------------------------------------------------------
        const { allowedDesignationIds, requiresTags } = visibilityConfig;

        if (Array.isArray(allowedDesignationIds) && allowedDesignationIds.length > 0) {
            for (const designationId of allowedDesignationIds) {
                await client.query(
                    `INSERT INTO form_applicability_designation_map (form_id, designation_id)
                     VALUES ($1, $2)
                     ON CONFLICT (form_id, designation_id) DO NOTHING`,
                    [formId, designationId]
                );
            }
        }

        // -----------------------------------------------------------------------
        // Step C: Write tag rules.
        // Each entry in requiresTags is { category, value }.  Look up the
        // tag_id from tag_definitions, then insert into form_applicability_tag_map.
        // If a category+value combo is not found in tag_definitions, skip it
        // (don't fail — the admin may have sent a stale value).
        // -----------------------------------------------------------------------
        if (Array.isArray(requiresTags) && requiresTags.length > 0) {
            for (const { category, value } of requiresTags) {
                if (!category || !value) continue;

                const tagRes = await client.query(
                    `SELECT id FROM tag_definitions
                     WHERE category = $1 AND value = $2 AND is_active = true`,
                    [category, value]
                );

                if (tagRes.rows.length === 0) {
                    // Tag not found — log and skip rather than crash.
                    console.warn(
                        `[syncFormApplicability] Tag not found: category="${category}" value="${value}" — skipped`
                    );
                    continue;
                }

                const tagId = tagRes.rows[0].id;

                await client.query(
                    `INSERT INTO form_applicability_tag_map (form_id, tag_id)
                     VALUES ($1, $2)
                     ON CONFLICT (form_id, tag_id) DO NOTHING`,
                    [formId, tagId]
                );
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { syncFormApplicability };
