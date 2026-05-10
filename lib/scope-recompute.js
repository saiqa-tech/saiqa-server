'use strict';

/**
 * scope-recompute.js
 *
 * Single source of truth for "which store UUIDs can this user access?"
 *
 * Exports one function: getEffectiveScope(userId)
 *
 * There is NO cache table in Phases 1–4.  All queries are live SQL.
 * When Phase 4 is complete and live queries are measurably slow, only the
 * internals of getEffectiveScope change (to read from user_effective_scope
 * cache table).  All callers remain identical.
 */

const { query } = require('../config/database');

/**
 * Returns the list of store UUIDs the given user is authorised to access.
 *
 * Algorithm:
 *   A. Look up the user's home unit (unit_id).
 *   B. The home unit is always in scope.
 *   C. Get the user's personal tags from entity_tag_map (entity_type = 'user').
 *   D. If the user has no personal tags, fall back to their home unit's tags.
 *      (Store Employees typically have no personal tags — they inherit from
 *       their store.)
 *   E. For every active unit in the system, check whether it has at least one
 *      matching tag in EACH tag category the user has.  Units that match all
 *      categories are added to scope.
 *   F. Return the deduplicated list of unit UUIDs.
 *
 * Matching rule (AND-across-categories, OR-within-category):
 *   If the user's effective tags are: Business_Unit=[SSS, KFC], Countries=[UAE]
 *   then a unit must have at least one of (SSS, KFC) AND at least UAE.
 *   A unit with only SSS but KSA country fails the Countries check.
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<string[]>} Deduplicated array of unit UUIDs in scope
 */
async function getEffectiveScope(userId) {
    // Step A: get the user's home unit
    const userRes = await query(
        'SELECT unit_id FROM users WHERE id = $1 AND is_active = true',
        [userId]
    );

    if (userRes.rows.length === 0) return [];

    const homeUnitId = userRes.rows[0].unit_id;
    const scopeSet = new Set();

    // Step B: home store is always in scope
    if (homeUnitId) scopeSet.add(homeUnitId);

    // Step C: personal tags for this user
    const personalTagsRes = await query(
        `SELECT etm.tag_id, td.category
     FROM entity_tag_map etm
     JOIN tag_definitions td ON td.id = etm.tag_id
     WHERE etm.entity_id = $1
       AND etm.entity_type = 'user'
       AND td.is_active = true`,
        [userId]
    );

    let effectiveTags = personalTagsRes.rows; // [{ tag_id, category }]

    // Step D: no personal tags → inherit from home unit
    if (effectiveTags.length === 0 && homeUnitId) {
        const unitTagsRes = await query(
            `SELECT etm.tag_id, td.category
       FROM entity_tag_map etm
       JOIN tag_definitions td ON td.id = etm.tag_id
       WHERE etm.entity_id = $1
         AND etm.entity_type = 'unit'
         AND td.is_active = true`,
            [homeUnitId]
        );
        effectiveTags = unitTagsRes.rows;
    }

    // No effective tags at all → scoped to home unit only
    if (effectiveTags.length === 0) return Array.from(scopeSet);

    // Build: category → Set<tagId> from the user's effective tag set
    const userTagsByCategory = new Map();
    for (const { tag_id, category } of effectiveTags) {
        if (!userTagsByCategory.has(category)) {
            userTagsByCategory.set(category, new Set());
        }
        userTagsByCategory.get(category).add(tag_id);
    }

    const requiredCategories = Array.from(userTagsByCategory.keys());

    // Step E: bulk load all active units + their tags in a single query
    // (LEFT JOIN so that units with no tags also appear — they won't match, but
    //  we still need them in the iteration to avoid a separate units query.)
    const allUnitTagsRes = await query(
        `SELECT u.id AS unit_id, etm.tag_id, td.category
     FROM units u
     LEFT JOIN entity_tag_map etm
       ON etm.entity_id = u.id AND etm.entity_type = 'unit'
     LEFT JOIN tag_definitions td
       ON td.id = etm.tag_id AND td.is_active = true
     WHERE u.is_active = true`
    );

    // Group into: unit_id → Map<category, Set<tagId>>
    const unitTagMap = new Map();
    for (const row of allUnitTagsRes.rows) {
        if (!unitTagMap.has(row.unit_id)) {
            unitTagMap.set(row.unit_id, new Map());
        }
        if (row.tag_id && row.category) {
            const catMap = unitTagMap.get(row.unit_id);
            if (!catMap.has(row.category)) catMap.set(row.category, new Set());
            catMap.get(row.category).add(row.tag_id);
        }
    }

    // Matching: unit must have ≥1 overlapping tag in EVERY required category
    for (const [unitId, unitCatMap] of unitTagMap) {
        if (scopeSet.has(unitId)) continue; // already included (home unit)

        let matches = true;
        for (const category of requiredCategories) {
            const userTagsInCat = userTagsByCategory.get(category);
            const unitTagsInCat = unitCatMap.get(category);

            if (!unitTagsInCat) {
                matches = false;
                break;
            }

            let overlap = false;
            for (const tagId of userTagsInCat) {
                if (unitTagsInCat.has(tagId)) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                matches = false;
                break;
            }
        }

        if (matches) scopeSet.add(unitId);
    }

    // Step F: return deduplicated list
    return Array.from(scopeSet);
}

module.exports = { getEffectiveScope };
