/**
 * F2: Failure-path regression tests for destructive and partial-write scenarios.
 *
 * These tests verify deliberate failure behavior so that:
 * 1. Tag deactivation is blocked when a tag is still referenced by form
 *    applicability rules (409 — prevents silently changing form visibility).
 * 2. Tag activation always succeeds regardless of form references (no guard
 *    needed on the inactive→active direction).
 * 3. Form deletion returns 200 even when saiqa-server applicability cleanup
 *    fails — the form is gone from CheckOps; orphaned rows are harmless and
 *    must not override the successful deletion response.
 *
 * Documented failure semantics (F1) for each workflow:
 *
 * tags-toggle (PATCH /api/tags/:tagId/toggle):
 *   - deactivate while referenced → 409 (no state change)
 *   - deactivate with no references → 200 (is_active flipped to false)
 *   - activate (any state) → 200 (is_active flipped to true, no reference check)
 *
 * forms-delete (DELETE /api/checkops/forms/:formId):
 *   - CheckOps deletion succeeds → 200 regardless of cleanup outcome
 *   - Cleanup failure is logged but does NOT change the response
 *   - Orphaned applicability rows are safe (they reference a gone form and
 *     are skipped by all query paths that join back to the forms table)
 */

'use strict';

// ── Tag toggle failure paths ──────────────────────────────────────────────────

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../utils/audit', () => ({
    logAudit: jest.fn(),
    getRequestInfo: jest.fn().mockReturnValue({}),
}));

const { query } = require('../config/database');
const { handler: tagsToggleHandler } = require('../steps/tags-toggle.step');

const TAG_ID = '123e4567-e89b-12d3-a456-426614174001';
const USER_ID = '123e4567-e89b-12d3-a456-426614174002';

const tagsReq = (overrides = {}) => ({
    pathParams: { tagId: TAG_ID },
    user: { userId: USER_ID },
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
});

describe('tags-toggle — failure and safety paths', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('deactivate is blocked with 409 when tag is referenced by form applicability', async () => {
        // Tag exists and is currently active
        query
            .mockResolvedValueOnce({ rows: [{ id: TAG_ID, is_active: true }] })
            // Form applicability reference exists
            .mockResolvedValueOnce({ rows: [{ 1: 1 }] });

        const response = await tagsToggleHandler(tagsReq(), { logger: { error: jest.fn() } });

        expect(response.status).toBe(409);
        expect(response.body.error).toMatch(/cannot deactivate/i);
    });

    test('deactivate succeeds with 200 when tag has no form references', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: TAG_ID, is_active: true }] })
            // No form references
            .mockResolvedValueOnce({ rows: [] })
            // UPDATE succeeds
            .mockResolvedValueOnce({
                rows: [{
                    id: TAG_ID, category: 'region', value: 'north',
                    label: 'North', is_active: false,
                    created_at: new Date('2025-01-01'),
                }],
            });

        const response = await tagsToggleHandler(tagsReq(), { logger: { error: jest.fn() } });

        expect(response.status).toBe(200);
        expect(response.body.tag.isActive).toBe(false);
    });

    test('activation skips the reference check and always succeeds', async () => {
        // Tag is currently inactive — no reference check should run
        query
            .mockResolvedValueOnce({ rows: [{ id: TAG_ID, is_active: false }] })
            // UPDATE succeeds
            .mockResolvedValueOnce({
                rows: [{
                    id: TAG_ID, category: 'region', value: 'north',
                    label: 'North', is_active: true,
                    created_at: new Date('2025-01-01'),
                }],
            });

        const response = await tagsToggleHandler(tagsReq(), { logger: { error: jest.fn() } });

        expect(response.status).toBe(200);
        expect(response.body.tag.isActive).toBe(true);
        // Should have been called exactly twice: EXISTS check + UPDATE (not the reference check)
        expect(query).toHaveBeenCalledTimes(2);
    });

    test('returns 404 when the tag does not exist', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        const response = await tagsToggleHandler(tagsReq(), { logger: { error: jest.fn() } });

        expect(response.status).toBe(404);
    });
});

// ── Form delete failure paths ─────────────────────────────────────────────────

jest.mock('../lib/checkops-wrapper', () => ({
    getCheckOpsWrapper: jest.fn(),
}));

const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { handler: formsDeleteHandler } = require('../steps/checkops-forms-delete.step');

const FORM_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('forms-delete — cleanup failure safety', () => {
    const wrapper = {
        initialized: true,
        initialize: jest.fn(),
        getForm: jest.fn(),
        deleteForm: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CHECKOPS_ENABLED = 'true';
        getCheckOpsWrapper.mockReturnValue(wrapper);
        wrapper.getForm.mockResolvedValue({ id: FORM_ID, sid: 'FORM-001', title: 'Test Form' });
        wrapper.deleteForm.mockResolvedValue({ success: true });
    });

    test('returns 200 even when applicability cleanup fails (orphaned rows are safe)', async () => {
        // First DELETE (designation_map) fails
        query
            .mockRejectedValueOnce(new Error('DB error: relation does not exist'));

        const response = await formsDeleteHandler(
            {
                pathParams: { formId: FORM_ID },
                user: { userId: USER_ID },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        // The form was deleted from CheckOps — caller must get 200
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // The CheckOps deletion was called
        expect(wrapper.deleteForm).toHaveBeenCalledWith(FORM_ID);
    });

    test('returns 200 when both cleanup queries succeed', async () => {
        query
            .mockResolvedValueOnce({ rows: [] })   // designation_map DELETE
            .mockResolvedValueOnce({ rows: [] });  // tag_map DELETE

        const response = await formsDeleteHandler(
            {
                pathParams: { formId: FORM_ID },
                user: { userId: USER_ID },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    test('returns 400 when formId is missing', async () => {
        const response = await formsDeleteHandler(
            {
                pathParams: {},
                user: { userId: USER_ID },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(400);
    });
});
