'use strict';

/**
 * visibility-engine.js
 *
 * Central decision-maker for the SAIQA Visibility System.
 * Answers specific yes/no questions about what a user can do and see.
 *
 * Exports six functions:
 *   1. checkCapability(designationId, action)         → { allowed, scopeType }
 *   2. getUserScope(userId)                           → string[]
 *   3. getFormApplicableUnits(formId, userDesignationId) → string[]
 *   4. computeEligibleUnits(userScopeIds, formIds)    → string[]
 *   5. resolveSubmissionEntry(eligibleUnits)          → entry decision object
 *   6. buildReportingFilter(userId, action)           → filter instruction object
 */

const { query } = require('../config/database');
const { getEffectiveScope } = require('./scope-recompute');

function hasAdminBypass({ role, userRole, designationCode } = {}) {
    return role === 'admin' || userRole === 'admin' || designationCode === 'ADMIN';
}

async function getAllActiveUnitIds() {
    const allUnitsRes = await query(
        'SELECT id FROM units WHERE is_active = true'
    );
    return allUnitsRes.rows.map((row) => row.id);
}

async function getUserVisibilityContext(userId) {
    const userRes = await query(
        `SELECT u.role,
                u.designation_id,
                u.unit_id,
                d.code AS designation_code
         FROM users u
         LEFT JOIN designations d ON d.id = u.designation_id
         WHERE u.id = $1 AND u.is_active = true`,
        [userId]
    );

    if (userRes.rows.length === 0) return null;

    const row = userRes.rows[0];
    return {
        role: row.role,
        designationId: row.designation_id,
        homeUnitId: row.unit_id,
        designationCode: row.designation_code,
    };
}

// ---------------------------------------------------------------------------
// 1. checkCapability
// ---------------------------------------------------------------------------

/**
 * Answers: "Is this designation allowed to perform this action?"
 *
 * Deny-by-default: if no permission row exists for (designationId, action),
 * returns { allowed: false }.
 *
 * @param {string} designationId - UUID of the user's designation
 * @param {string} action        - One of: SUBMIT_FORM, VIEW_SUBMISSION,
 *                                 VIEW_FINDING, UPDATE_FINDING, VIEW_REPORT,
 *                                 MANAGE_FORM
 * @returns {Promise<{ allowed: boolean, scopeType?: 'own' | 'scoped' | 'all' }>}
 */
async function checkCapability(designationId, action, options = {}) {
    if (hasAdminBypass(options)) {
        return { allowed: true, scopeType: 'all' };
    }

    if (!designationId) {
        return { allowed: false };
    }

    const res = await query(
        `SELECT d.code AS designation_code,
                dp.allowed,
                dp.scope_type
         FROM designations d
         LEFT JOIN designation_permissions dp
           ON dp.designation_id = d.id
          AND dp.action = $2
         WHERE d.id = $1`,
        [designationId, action]
    );

    if (res.rows.length === 0) {
        return { allowed: false };
    }

    const row = res.rows[0];

    if (hasAdminBypass({ designationCode: row.designation_code })) {
        return { allowed: true, scopeType: 'all' };
    }

    if (row.allowed === null || row.allowed === undefined) {
        return { allowed: false };
    }

    return { allowed: row.allowed, scopeType: row.scope_type };
}

// ---------------------------------------------------------------------------
// 2. getUserScope
// ---------------------------------------------------------------------------

/**
 * Returns the list of store UUIDs this user is authorised to access.
 * Delegates entirely to scope-recompute.js (live SQL, no cache).
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<string[]>}
 */
async function getUserScope(userId) {
    const userContext = await getUserVisibilityContext(userId);

    if (!userContext) return [];

    if (hasAdminBypass(userContext)) {
        return getAllActiveUnitIds();
    }

    return getEffectiveScope(userId);
}

// ---------------------------------------------------------------------------
// 3. getFormApplicableUnits
// ---------------------------------------------------------------------------

/**
 * Returns the store UUIDs that a given form is designed for AND that the
 * caller's designation is permitted to interact with.
 *
 * Steps:
 *   A. Check form_applicability_designation_map — if this designation has no
 *      row for this form, return [] immediately.
 *   B. Get the form's required tags from form_applicability_tag_map.
 *   C. If no tag requirements exist, return ALL active units (legacy forms).
 *   D. Read forms.require_all from checkops forms table to know
 *      whether to apply AND or OR logic across required tags.
 *   E. Find all active units whose tags match the form's requirements.
 *   F. Return the matching unit UUIDs.
 *
 * @param {string} formId            - UUID of the form (checkops form)
 * @param {string} userDesignationId - UUID of the caller's designation
 * @returns {Promise<string[]>}
 */
async function getFormApplicableUnits(formId, userDesignationId, options = {}) {
    if (hasAdminBypass(options)) {
        return getAllActiveUnitIds();
    }

    // Step A: designation check
    // First count total designation rows for this form (not just the caller's).
    // If ZERO rows exist for this form at all, the form was created before the
    // visibility system and has never been configured.  Treat it as open to all
    // designations (backward-compatible escape hatch matching the tag side's
    // Step C behaviour).
    // If at least one designation row exists but the caller's is not among them,
    // deny strictly — the form has been explicitly configured and this
    // designation was not included.
    const totalDesigRes = await query(
        `SELECT designation_id FROM form_applicability_designation_map
     WHERE form_id = $1`,
        [formId]
    );

    if (totalDesigRes.rows.length > 0) {
        // Form has configuration — check if caller's designation is allowed
        const callerAllowed = totalDesigRes.rows.some(
            (r) => r.designation_id === userDesignationId
        );
        if (!callerAllowed) return [];
    }
    // else: zero rows → unconfigured legacy form → fall through (open to all designations)

    // Step B: tag requirements for this form
    const tagReqRes = await query(
        `SELECT fatm.tag_id, td.category
     FROM form_applicability_tag_map fatm
     JOIN tag_definitions td ON td.id = fatm.tag_id AND td.is_active = true
     WHERE fatm.form_id = $1`,
        [formId]
    );

    // Step C: no tag requirements → form is open to all active units
    if (tagReqRes.rows.length === 0) {
        const allUnitsRes = await query(
            'SELECT id FROM units WHERE is_active = true'
        );
        return allUnitsRes.rows.map((r) => r.id);
    }

    // Step D: read require_all from the checkops forms table
    // (same physical DB — queried directly via the shared pool)
    const formRes = await query(
        `SELECT require_all FROM forms WHERE id = $1`,
        [formId]
    );

    const requireAll =
        formRes.rows.length > 0 &&
        formRes.rows[0].require_all === true;

    // Step E: match active units against tag requirements
    // Build: category → Set<requiredTagId> from form requirements
    const requiredTagsByCategory = new Map();
    const allRequiredTagIds = new Set();
    for (const { tag_id, category } of tagReqRes.rows) {
        if (!requiredTagsByCategory.has(category)) {
            requiredTagsByCategory.set(category, new Set());
        }
        requiredTagsByCategory.get(category).add(tag_id);
        allRequiredTagIds.add(tag_id);
    }

    const requiredCategories = Array.from(requiredTagsByCategory.keys());

    // Bulk load active units + their tags
    const unitTagsRes = await query(
        `SELECT u.id AS unit_id, etm.tag_id, td.category
     FROM units u
     LEFT JOIN entity_tag_map etm
       ON etm.entity_id = u.id AND etm.entity_type = 'unit'
     LEFT JOIN tag_definitions td
       ON td.id = etm.tag_id AND td.is_active = true
     WHERE u.is_active = true`
    );

    // Group: unit_id → Map<category, Set<tagId>>
    const unitTagMap = new Map();
    for (const row of unitTagsRes.rows) {
        if (!unitTagMap.has(row.unit_id)) {
            unitTagMap.set(row.unit_id, new Map());
        }
        if (row.tag_id && row.category) {
            const catMap = unitTagMap.get(row.unit_id);
            if (!catMap.has(row.category)) catMap.set(row.category, new Set());
            catMap.get(row.category).add(row.tag_id);
        }
    }

    const matchingUnitIds = [];

    for (const [unitId, unitCatMap] of unitTagMap) {
        let matches;

        if (requireAll) {
            // AND logic: unit must match at least one required tag in EVERY category
            matches = requiredCategories.every((category) => {
                const required = requiredTagsByCategory.get(category);
                const unitTags = unitCatMap.get(category);
                if (!unitTags) return false;
                return [...required].some((tagId) => unitTags.has(tagId));
            });
        } else {
            // OR logic: unit must match at least one required tag across ALL categories
            matches = [...allRequiredTagIds].some((tagId) => {
                for (const unitTags of unitCatMap.values()) {
                    if (unitTags.has(tagId)) return true;
                }
                return false;
            });
        }

        if (matches) matchingUnitIds.push(unitId);
    }

    // Step F
    return matchingUnitIds;
}

// ---------------------------------------------------------------------------
// 4. computeEligibleUnits
// ---------------------------------------------------------------------------

/**
 * Returns the intersection of two unit UUID lists.
 *
 * "Given the stores you are allowed to access (user scope) AND the stores
 *  this form applies to (form applicability) — what is the overlap?"
 *
 * @param {string[]} userScopeUnitIds       - From getUserScope()
 * @param {string[]} formApplicableUnitIds  - From getFormApplicableUnits()
 * @returns {string[]}
 */
function computeEligibleUnits(userScopeUnitIds, formApplicableUnitIds) {
    const formSet = new Set(formApplicableUnitIds);
    return userScopeUnitIds.filter((id) => formSet.has(id));
}

// ---------------------------------------------------------------------------
// 5. resolveSubmissionEntry
// ---------------------------------------------------------------------------

/**
 * Decides what the submission start experience should be for a user, based on
 * how many eligible stores they have for a given form.
 *
 * @param {Array<{ id: string, name: string, code: string }>} eligibleUnits
 * @returns {{ canSubmit: boolean, requiresUnitSelection?: boolean, defaultUnitId?: string, eligibleUnits?: Array }}
 *
 * Return shapes:
 *   0 stores → { canSubmit: false }
 *   1 store  → { canSubmit: true, requiresUnitSelection: false, defaultUnitId: '...' }
 *   2+ stores → { canSubmit: true, requiresUnitSelection: true, eligibleUnits: [...] }
 */
function resolveSubmissionEntry(eligibleUnits) {
    if (eligibleUnits.length === 0) {
        return { canSubmit: false };
    }

    if (eligibleUnits.length === 1) {
        return {
            canSubmit: true,
            requiresUnitSelection: false,
            defaultUnitId: eligibleUnits[0].id
        };
    }

    return {
        canSubmit: true,
        requiresUnitSelection: true,
        eligibleUnits
    };
}

// ---------------------------------------------------------------------------
// 6. buildReportingFilter
// ---------------------------------------------------------------------------

/**
 * Builds a filter instruction for list/stats endpoints so they return only
 * data within the caller's authorised scope.
 *
 * @param {string} userId  - UUID of the calling user
 * @param {string} action  - The action being performed (e.g. VIEW_SUBMISSION)
 * @returns {Promise<
 *   { allow: false } |
 *   { allow: true, filterType: 'SELF',  homeUnitId: string } |
 *   { allow: true, filterType: 'SCOPE', unitIds: string[] }
 * >}
 */
async function buildReportingFilter(userId, action) {
    const userContext = await getUserVisibilityContext(userId);

    if (!userContext) return { allow: false };

    const {
        designationId,
        homeUnitId,
        designationCode,
    } = userContext;

    if (hasAdminBypass(userContext)) {
        return { allow: true, filterType: 'ALL' };
    }

    if (!designationId) return { allow: false };

    const capability = await checkCapability(designationId, action, { designationCode });

    if (!capability.allowed) return { allow: false };

    if (capability.scopeType === 'all') {
        return { allow: true, filterType: 'ALL' };
    }

    if (capability.scopeType === 'own') {
        return { allow: true, filterType: 'SELF', homeUnitId };
    }

    if (capability.scopeType === 'scoped') {
        const unitIds = await getUserScope(userId);
        return { allow: true, filterType: 'SCOPE', unitIds };
    }

    return { allow: false };
}

module.exports = {
    checkCapability,
    getUserScope,
    getFormApplicableUnits,
    computeEligibleUnits,
    resolveSubmissionEntry,
    buildReportingFilter
};
