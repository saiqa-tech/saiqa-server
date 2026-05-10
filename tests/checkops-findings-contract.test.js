/**
 * Contract tests for the CheckOps findings endpoints.
 *
 * Validates that the response shapes produced by the GET single-finding
 * and list-findings handlers conform to the shared FindingTargetingFieldsSchema
 * contract.  These tests catch nullability drift before it reaches production.
 *
 * Test scope: handler-level only.  DB and visibility-engine are mocked so
 * these tests run without a database connection.
 */

'use strict';

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../lib/visibility-engine', () => ({
    buildReportingFilter: jest.fn(),
}));

const { FindingTargetingFieldsSchema } = require('@saiqa-tech/contracts');
const { query } = require('../config/database');
const { buildReportingFilter } = require('../lib/visibility-engine');
const { handler: getHandler } = require('../steps/checkops-findings-get.step');
const { handler: listHandler } = require('../steps/checkops-findings-list.step');

const FINDING_ID = '123e4567-e89b-12d3-a456-426614174001';
const FORM_ID = '123e4567-e89b-12d3-a456-426614174002';
const SUBMISSION_ID = '123e4567-e89b-12d3-a456-426614174003';
const QUESTION_ID = '123e4567-e89b-12d3-a456-426614174004';
const UNIT_ID = '123e4567-e89b-12d3-a456-426614174005';
const USER_ID = '123e4567-e89b-12d3-a456-426614174006';
const CREATED_AT = new Date('2025-01-01T00:00:00.000Z');

function makeRow(overrides = {}) {
    return {
        id: FINDING_ID,
        sid: 'FND-001',
        submission_id: SUBMISSION_ID,
        submission_sid: 'SUB-001',
        question_id: QUESTION_ID,
        question_sid: 'QST-001',
        form_id: FORM_ID,
        form_sid: 'FRM-001',
        severity: 'medium',
        department: 'Operations',
        observation: 'Test observation',
        root_cause: null,
        evidence_urls: null,
        assignment: null,
        status: 'open',
        metadata: {},
        created_at: CREATED_AT,
        created_by: USER_ID,
        target_unit_id: null,
        form_title: 'Safety Audit',
        question_text: 'Is the fire exit clear?',
        target_unit_name: null,
        ...overrides,
    };
}

const ADMIN_FILTER = { allow: true, filterType: 'ALL' };
const SELF_FILTER = { allow: true, filterType: 'SELF', homeUnitId: UNIT_ID };

describe('checkops findings — response contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CHECKOPS_ENABLED = 'true';
    });

    // ── GET single finding ─────────────────────────────────────────────────

    test('GET: legacy row (pre-Phase-3) returns null targeting fields', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);
        query.mockResolvedValueOnce({ rows: [makeRow()] });

        const response = await getHandler(
            {
                pathParams: { id: FINDING_ID },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const fields = FindingTargetingFieldsSchema.parse(response.body.data);
        expect(fields.targetUnitId).toBeNull();
        expect(fields.targetUnitName).toBeNull();
    });

    test('GET: Phase-3 row returns populated targeting fields', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);
        query.mockResolvedValueOnce({
            rows: [makeRow({ target_unit_id: UNIT_ID, target_unit_name: 'Store A' })],
        });

        const response = await getHandler(
            {
                pathParams: { id: FINDING_ID },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const fields = FindingTargetingFieldsSchema.parse(response.body.data);
        expect(fields.targetUnitId).toBe(UNIT_ID);
        expect(fields.targetUnitName).toBe('Store A');
    });

    test('GET: findings response does NOT include submitterUserId (not part of findings contract)', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);
        query.mockResolvedValueOnce({ rows: [makeRow()] });

        const response = await getHandler(
            {
                pathParams: { id: FINDING_ID },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        // submitterUserId must not appear in the finding response body
        expect(response.body.data).not.toHaveProperty('submitterUserId');
    });

    test('GET: SELF filter with mismatched unit returns 404 (scope enforcement)', async () => {
        buildReportingFilter.mockResolvedValue(SELF_FILTER);
        query.mockResolvedValueOnce({
            rows: [makeRow({ target_unit_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' })],
        });

        const response = await getHandler(
            {
                pathParams: { id: FINDING_ID },
                user: { userId: USER_ID, role: 'user' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(404);
    });

    // ── GET findings list ──────────────────────────────────────────────────

    test('LIST: returns paginated envelope with targeting fields in each item', async () => {
        buildReportingFilter.mockResolvedValue(ADMIN_FILTER);

        // findings list with formId executes Promise.all([dataQuery, countQuery])
        // First queued mock → dataRes, second → countRes
        query
            .mockResolvedValueOnce({
                rows: [
                    makeRow({ target_unit_id: UNIT_ID, target_unit_name: 'Store B' }),
                    makeRow({ target_unit_id: null, target_unit_name: null }),
                ],
            })
            .mockResolvedValueOnce({ rows: [{ total: '2' }] });

        const response = await listHandler(
            {
                queryParams: { formId: FORM_ID, page: '1', limit: '20' },
                user: { userId: USER_ID, role: 'admin' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        expect(response.body.pagination).toMatchObject({ total: 2 });

        // Phase-3 item
        const first = FindingTargetingFieldsSchema.parse(response.body.data[0]);
        expect(first.targetUnitId).toBe(UNIT_ID);
        expect(first.targetUnitName).toBe('Store B');

        // Legacy item
        const second = FindingTargetingFieldsSchema.parse(response.body.data[1]);
        expect(second.targetUnitId).toBeNull();
        expect(second.targetUnitName).toBeNull();
    });
});
