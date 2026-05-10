/**
 * Contract tests for the CheckOps forms write endpoints.
 *
 * Both POST /api/checkops/forms and PUT /api/checkops/forms/:formId enrich
 * their responses with a `visibility` field built by buildFormVisibility, which
 * calls FormVisibilitySchema.parse() internally.
 *
 * These tests verify:
 * 1. The success response always includes a `visibility` key that parses
 *    against FormVisibilitySchema.
 * 2. Default visibility (no client-supplied visibility key) produces
 *    requireAll: true with empty restriction arrays.
 * 3. Explicit visibility config round-trips correctly through the response.
 *
 * Test scope: handler-level only.  All external dependencies are mocked.
 */

'use strict';

jest.mock('../lib/checkops-wrapper', () => ({
    getCheckOpsWrapper: jest.fn(),
}));
jest.mock('../lib/checkops-validation', () => ({
    validateFormData: jest.fn(),
}));
jest.mock('../lib/checkops-question-id-mapper', () => ({
    createFormWithQuestionIds: jest.fn(),
}));
jest.mock('../lib/form-applicability-sync', () => ({
    syncFormApplicability: jest.fn(),
}));
jest.mock('../lib/checkops-form-enricher', () => ({
    enrichFormQuestions: jest.fn(),
}));
jest.mock('../utils/audit', () => ({
    logAudit: jest.fn(),
}));
jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { FormVisibilitySchema } = require('@saiqa-tech/contracts');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFormData } = require('../lib/checkops-validation');
const { createFormWithQuestionIds } = require('../lib/checkops-question-id-mapper');
const { syncFormApplicability } = require('../lib/form-applicability-sync');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { query } = require('../config/database');
const { handler: createHandler } = require('../steps/checkops-forms-create.step');
const { handler: updateHandler } = require('../steps/checkops-forms-update.step');

const FORM_ID = '123e4567-e89b-12d3-a456-426614174000';
const DESIG_ID = '123e4567-e89b-12d3-a456-426614174001';

function makeForm(overrides = {}) {
    return {
        id: FORM_ID,
        sid: 'FORM-001',
        title: 'Test Form',
        description: 'A test form',
        questions: [],
        metadata: {},
        requireAll: true,
        ...overrides,
    };
}

const wrapper = {
    initialized: true,
    initialize: jest.fn(),
    deleteForm: jest.fn(),
    getForm: jest.fn(),
    updateForm: jest.fn(),
};

beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHECKOPS_ENABLED = 'true';
    getCheckOpsWrapper.mockReturnValue(wrapper);
    validateFormData.mockReturnValue([]);
    enrichFormQuestions.mockResolvedValue(undefined);
    syncFormApplicability.mockResolvedValue(undefined);
});

// ── POST /api/checkops/forms ──────────────────────────────────────────────────

describe('checkops forms create — visibility contract', () => {
    test('response includes a visibility field that parses as FormVisibilitySchema', async () => {
        createFormWithQuestionIds.mockResolvedValue(makeForm());

        const response = await createHandler(
            {
                body: { title: 'Test Form', description: 'Desc', questions: [], metadata: {} },
                user: { userId: 'user-1' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(201);
        // Must not throw
        const vis = FormVisibilitySchema.parse(response.body.data.visibility);
        // Default: require_all=true, empty arrays
        expect(vis.require_all).toBe(true);
        expect(vis.allowedDesignationIds).toEqual([]);
        expect(vis.requiresTags).toEqual([]);
    });

    test('explicit visibility config round-trips correctly through the response', async () => {
        createFormWithQuestionIds.mockResolvedValue(makeForm({ requireAll: false }));

        const response = await createHandler(
            {
                body: {
                    title: 'Restricted Form',
                    description: '',
                    questions: [],
                    metadata: {},
                    visibility: {
                        require_all: false,
                        allowedDesignationIds: [DESIG_ID],
                        requiresTags: [{ category: 'region', value: 'north' }],
                    },
                },
                user: { userId: 'user-1' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(201);
        const vis = FormVisibilitySchema.parse(response.body.data.visibility);
        expect(vis.require_all).toBe(false);
        expect(vis.allowedDesignationIds).toEqual([DESIG_ID]);
        expect(vis.requiresTags).toEqual([{ category: 'region', value: 'north' }]);
    });
});

// ── PUT /api/checkops/forms/:formId ───────────────────────────────────────────

describe('checkops forms update — visibility contract', () => {
    test('response includes a visibility field that parses as FormVisibilitySchema', async () => {
        wrapper.updateForm.mockResolvedValue(makeForm());
        // DB calls for building visibility after update: designation rows + tag rows
        query
            .mockResolvedValueOnce({ rows: [] })          // designation_map
            .mockResolvedValueOnce({ rows: [] });         // tag_map

        const response = await updateHandler(
            {
                pathParams: { formId: FORM_ID },
                body: { title: 'Updated Form' },
                user: { userId: 'user-1' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const vis = FormVisibilitySchema.parse(response.body.data.visibility);
        expect(vis.require_all).toBe(true);
        expect(vis.allowedDesignationIds).toEqual([]);
        expect(vis.requiresTags).toEqual([]);
    });

    test('update with explicit visibility reflects designation rows from DB in response', async () => {
        wrapper.getForm.mockResolvedValue(makeForm({ requireAll: true }));
        wrapper.updateForm.mockResolvedValue(makeForm({ requireAll: false }));
        // DB calls for building visibility: designation rows + tag rows
        query
            .mockResolvedValueOnce({ rows: [{ designation_id: DESIG_ID }] })
            .mockResolvedValueOnce({ rows: [{ category: 'region', value: 'north' }] });

        const response = await updateHandler(
            {
                pathParams: { formId: FORM_ID },
                body: {
                    title: 'Updated Form',
                    visibility: {
                        require_all: false,
                        allowedDesignationIds: [DESIG_ID],
                        requiresTags: [{ category: 'region', value: 'north' }],
                    },
                },
                user: { userId: 'user-1' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const vis = FormVisibilitySchema.parse(response.body.data.visibility);
        expect(vis.require_all).toBe(false);
        expect(vis.allowedDesignationIds).toEqual([DESIG_ID]);
        expect(vis.requiresTags).toEqual([{ category: 'region', value: 'north' }]);
    });
});
