/**
 * Contract tests for the CheckOps submissions endpoints.
 *
 * Validates that the response shapes produced by the GET single-submission
 * and list-submissions handlers conform to the shared SubmissionTargetingFieldsSchema
 * contract.  These tests catch nullability drift (e.g. a developer removing
 * `.nullable()` from targetUnitId on one side) before it reaches production.
 *
 * Test scope: handler-level only.  DB and visibility-engine are mocked so
 * that these tests run without a database connection.
 */

'use strict';

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../lib/visibility-engine', () => ({
    buildReportingFilter: jest.fn(),
}));

const { SubmissionTargetingFieldsSchema } = require('@saiqa-tech/contracts');
const { query } = require('../config/database');
const { buildReportingFilter } = require('../lib/visibility-engine');
const { handler: getHandler } = require('../steps/checkops-submissions-get.step');
const { handler: listHandler } = require('../steps/checkops-submissions-list.step');

const FORM_ID = '123e4567-e89b-12d3-a456-426614174001';
const SUBMISSION_ID = '123e4567-e89b-12d3-a456-426614174002';
const UNIT_ID = '123e4567-e89b-12d3-a456-426614174003';
const USER_ID = '123e4567-e89b-12d3-a456-426614174004';

function makeRow(overrides = {}) {
    return {
        id: SUBMISSION_ID,
        sid: 'SUB-001',
        form_id: FORM_ID,
        form_sid: 'FRM-001',
        submission_data: { q1: 'yes' },
        metadata: {},
        submitted_at: new Date('2025-01-01T00:00:00.000Z'),
        target_unit_id: null,
        submitter_user_id: null,
        target_unit_name: null,
        form_title: 'Safety Audit',
        ...overrides,
    };
}

const ADMIN_FILTER = { allow: true, filterType: 'ALL' };
const SELF_FILTER = { allow: true, filterType: 'SELF', homeUnitId: UNIT_ID };

describe('checkops submissions — response contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CHECKOPS_ENABLED = 'true';
    });

    // ── GET single submission ──────────────────────────────────────────────

    test('GET: legacy row (pre-Phase-3) returns null targeting fields', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);
        query.mockResolvedValueOnce({ rows: [makeRow()] });

        const response = await getHandler(
            {
                pathParams: { id: SUBMISSION_ID },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const fields = SubmissionTargetingFieldsSchema.parse(response.body.data);
        expect(fields.targetUnitId).toBeNull();
        expect(fields.submitterUserId).toBeNull();
        expect(fields.targetUnitName).toBeNull();
    });

    test('GET: Phase-3 row returns populated targeting fields', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);
        query.mockResolvedValueOnce({
            rows: [makeRow({
                target_unit_id: UNIT_ID,
                submitter_user_id: USER_ID,
                target_unit_name: 'Store A',
            })],
        });

        const response = await getHandler(
            {
                pathParams: { id: SUBMISSION_ID },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const fields = SubmissionTargetingFieldsSchema.parse(response.body.data);
        expect(fields.targetUnitId).toBe(UNIT_ID);
        expect(fields.submitterUserId).toBe(USER_ID);
        expect(fields.targetUnitName).toBe('Store A');
    });

    test('GET: SELF filter with matching unit returns 200', async () => {
        buildReportingFilter.mockResolvedValue(SELF_FILTER);
        query.mockResolvedValueOnce({
            rows: [makeRow({ target_unit_id: UNIT_ID })],
        });

        const response = await getHandler(
            {
                pathParams: { id: SUBMISSION_ID },
                user: { userId: USER_ID, role: 'user' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const fields = SubmissionTargetingFieldsSchema.parse(response.body.data);
        expect(fields.targetUnitId).toBe(UNIT_ID);
    });

    test('GET: SELF filter with mismatched unit returns 404 (scope enforcement)', async () => {
        buildReportingFilter.mockResolvedValue(SELF_FILTER);
        // Use a different valid UUID to trigger the mismatch
        const otherUnit = '123e4567-e89b-12d3-a456-426614174999';
        query.mockResolvedValueOnce({
            rows: [makeRow({ target_unit_id: otherUnit })],
        });

        const response = await getHandler(
            {
                pathParams: { id: SUBMISSION_ID },
                user: { userId: USER_ID, role: 'user' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(404);
    });

    // ── GET submissions list ───────────────────────────────────────────────

    test('LIST: returns paginated envelope with targeting fields in each item', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);

        // Submissions list: COUNT query executes first, then DATA query (sequential)
        query
            .mockResolvedValueOnce({ rows: [{ total: '2' }] })
            .mockResolvedValueOnce({
                rows: [
                    makeRow({ target_unit_id: UNIT_ID, submitter_user_id: USER_ID, target_unit_name: 'Store A' }),
                    makeRow({ target_unit_id: null, submitter_user_id: null, target_unit_name: null }),
                ],
            });

        const response = await listHandler(
            {
                queryParams: { formId: FORM_ID, page: '1', limit: '20' },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        expect(response.body.pagination).toMatchObject({ page: 1, limit: 20, total: 2 });

        // First item: Phase-3 row
        const first = SubmissionTargetingFieldsSchema.parse(response.body.data[0]);
        expect(first.targetUnitId).toBe(UNIT_ID);
        expect(first.submitterUserId).toBe(USER_ID);
        expect(first.targetUnitName).toBe('Store A');

        // Second item: legacy row
        const second = SubmissionTargetingFieldsSchema.parse(response.body.data[1]);
        expect(second.targetUnitId).toBeNull();
        expect(second.submitterUserId).toBeNull();
        expect(second.targetUnitName).toBeNull();
    });
});
