/**
 * T3: Integration checks for the CheckOps-backed server enrichment paths.
 *
 * The server reshapes CheckOps output before the client sees it in two ways:
 *
 * 1. Question enrichment (checkops-form-enricher.js):
 *    CheckOps stores questions as UUID strings internally.  Before any form is
 *    returned to the client the server must batch-fetch question bank entries and
 *    convert UUIDs to full question objects.  If this path breaks, the client's
 *    FormResponseSchema parse fails.
 *
 * 2. Visibility payload (checkops-form-visibility.js + forms-get.step.js):
 *    The forms-get endpoint reads designation and tag applicability rows from
 *    saiqa-server tables and merges them into form.visibility via buildFormVisibility.
 *    If this path breaks, the FormBuilder loses its current visibility configuration
 *    after every save or reload.
 *
 * These tests prove both paths work end-to-end so any future change to
 * the enricher or visibility builder fails loudly here rather than silently at
 * the client parse layer.
 */

'use strict';

// ── checkops-form-enricher.js unit tests ─────────────────────────────────────

const { enrichFormQuestions } = require('../lib/checkops-form-enricher');

const QUESTION_UUID_A = '123e4567-e89b-12d3-a456-426614174001';
const QUESTION_UUID_B = '123e4567-e89b-12d3-a456-426614174002';
const QUESTION_UUID_MISSING = '123e4567-e89b-12d3-a456-426614174999';

function makeBankQuestion(id, overrides = {}) {
    return {
        id,
        questionText: `Question for ${id}`,
        questionType: 'text',
        options: null,
        validationRules: null,
        ...overrides,
    };
}

describe('enrichFormQuestions — enrichment path', () => {
    test('converts UUID string questions to full question objects', async () => {
        const wrapper = {
            getQuestions: jest.fn().mockResolvedValue([
                makeBankQuestion(QUESTION_UUID_A),
                makeBankQuestion(QUESTION_UUID_B),
            ]),
        };
        const form = {
            questions: [QUESTION_UUID_A, QUESTION_UUID_B],
            metadata: {},
        };

        await enrichFormQuestions(form, wrapper);

        expect(form.questions).toHaveLength(2);
        expect(form.questions[0]).toMatchObject({
            questionId: QUESTION_UUID_A,
            questionText: `Question for ${QUESTION_UUID_A}`,
            questionType: 'text',
            required: false,
        });
        expect(form.questions[1].questionId).toBe(QUESTION_UUID_B);
    });

    test('produces a placeholder when a question UUID is not in the bank (deleted question)', async () => {
        const wrapper = {
            getQuestions: jest.fn().mockResolvedValue([]),
        };
        const form = {
            questions: [QUESTION_UUID_MISSING],
            metadata: {},
        };

        await enrichFormQuestions(form, wrapper);

        expect(form.questions[0]).toMatchObject({
            questionId: QUESTION_UUID_MISSING,
            questionText: '[Deleted Question]',
            questionType: 'text',
            required: false,
        });
    });

    test('passes through already-enriched question objects unchanged', async () => {
        const wrapper = { getQuestions: jest.fn() };
        const alreadyEnriched = {
            questionId: QUESTION_UUID_A,
            questionText: 'Pre-enriched',
            questionType: 'select',
        };
        const form = {
            questions: [alreadyEnriched],
            metadata: {},
        };

        await enrichFormQuestions(form, wrapper);

        // getQuestions must NOT be called — no UUID strings to fetch
        expect(wrapper.getQuestions).not.toHaveBeenCalled();
        expect(form.questions[0]).toBe(alreadyEnriched);
    });

    test('returns the form unchanged when questions array is empty', async () => {
        const wrapper = { getQuestions: jest.fn() };
        const form = { questions: [], metadata: {} };

        const result = await enrichFormQuestions(form, wrapper);

        expect(result).toBe(form);
        expect(wrapper.getQuestions).not.toHaveBeenCalled();
    });

    test('re-attaches question overrides from form.metadata.questionOverrides', async () => {
        const wrapper = {
            getQuestions: jest.fn().mockResolvedValue([
                makeBankQuestion(QUESTION_UUID_A),
            ]),
        };
        const form = {
            questions: [QUESTION_UUID_A],
            metadata: {
                questionOverrides: {
                    [QUESTION_UUID_A]: { required: true, placeholder: 'Enter value' },
                },
            },
        };

        await enrichFormQuestions(form, wrapper);

        expect(form.questions[0].overrides).toEqual({
            required: true,
            placeholder: 'Enter value',
        });
    });

    test('does not attach overrides when the key is absent or empty', async () => {
        const wrapper = {
            getQuestions: jest.fn().mockResolvedValue([
                makeBankQuestion(QUESTION_UUID_A),
            ]),
        };
        const form = {
            questions: [QUESTION_UUID_A],
            metadata: {},
        };

        await enrichFormQuestions(form, wrapper);

        expect(form.questions[0].overrides).toBeUndefined();
    });
});

// ── buildFormVisibility — visibility payload path ─────────────────────────────

const { buildFormVisibility } = require('../lib/checkops-form-visibility');
const { FormVisibilitySchema } = require('@saiqa-tech/contracts');

const DESIG_A = '123e4567-e89b-12d3-a456-426614174001';
const DESIG_B = '123e4567-e89b-12d3-a456-426614174002';

describe('buildFormVisibility — enrichment path', () => {
    test('output parses against the shared FormVisibilitySchema contract', () => {
        const vis = buildFormVisibility({
            requireAll: false,
            designationIds: [DESIG_A],
            tagEntries: [{ category: 'region', value: 'north' }],
        });
        const parsed = FormVisibilitySchema.parse(vis);
        expect(parsed.require_all).toBe(false);
        expect(parsed.allowedDesignationIds).toEqual([DESIG_A]);
        expect(parsed.requiresTags).toEqual([{ category: 'region', value: 'north' }]);
    });

    test('defaults requireAll to true when not provided', () => {
        const vis = buildFormVisibility({ requireAll: undefined });
        expect(FormVisibilitySchema.parse(vis).require_all).toBe(true);
    });

    test('returns empty restriction arrays when no designations or tags', () => {
        const vis = buildFormVisibility({ requireAll: true });
        expect(vis.allowedDesignationIds).toEqual([]);
        expect(vis.requiresTags).toEqual([]);
    });

    test('throws ZodError when a non-UUID is passed as designationId', () => {
        expect(() =>
            buildFormVisibility({
                requireAll: true,
                designationIds: ['not-a-uuid'],
            })
        ).toThrow();
    });

    test('multiple designation IDs are preserved in output order', () => {
        const vis = buildFormVisibility({
            requireAll: true,
            designationIds: [DESIG_A, DESIG_B],
        });
        expect(vis.allowedDesignationIds).toEqual([DESIG_A, DESIG_B]);
    });
});

// ── Forms GET enrichment end-to-end path ─────────────────────────────────────

jest.mock('../lib/checkops-wrapper', () => ({
    getCheckOpsWrapper: jest.fn(),
}));
jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { query } = require('../config/database');
const { handler: formsGetHandler } = require('../steps/checkops-forms-get.step');

const FORM_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('forms GET — enrichment end-to-end path', () => {
    const wrapper = {
        initialized: true,
        initialize: jest.fn(),
        getForm: jest.fn(),
        getQuestions: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CHECKOPS_ENABLED = 'true';
        getCheckOpsWrapper.mockReturnValue(wrapper);
    });

    test('enriched form response includes both question objects and a parsed visibility field', async () => {
        wrapper.getForm.mockResolvedValue({
            id: FORM_ID,
            sid: 'FORM-001',
            title: 'Test Form',
            questions: [QUESTION_UUID_A],
            metadata: {},
            requireAll: false,
        });
        wrapper.getQuestions.mockResolvedValue([
            makeBankQuestion(QUESTION_UUID_A, { questionType: 'boolean' }),
        ]);
        // DB calls for visibility: designation rows + tag rows
        query
            .mockResolvedValueOnce({ rows: [{ designation_id: DESIG_A }] })
            .mockResolvedValueOnce({ rows: [{ category: 'region', value: 'south' }] });

        const response = await formsGetHandler(
            {
                pathParams: { formId: FORM_ID },
                user: { userId: '123e4567-e89b-12d3-a456-426614174099', role: 'admin' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        const form = response.body.data;

        // Question was enriched from UUID to object
        expect(form.questions[0].questionId).toBe(QUESTION_UUID_A);
        expect(form.questions[0].questionType).toBe('boolean');

        // Visibility field parses against the shared contract
        const vis = FormVisibilitySchema.parse(form.visibility);
        expect(vis.require_all).toBe(false);
        expect(vis.allowedDesignationIds).toEqual([DESIG_A]);
        expect(vis.requiresTags).toEqual([{ category: 'region', value: 'south' }]);
    });

    test('form with no visibility restrictions returns empty arrays in visibility field', async () => {
        wrapper.getForm.mockResolvedValue({
            id: FORM_ID,
            sid: 'FORM-001',
            title: 'Open Form',
            questions: [],
            metadata: {},
            requireAll: true,
        });
        // No designation or tag rows
        query
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const response = await formsGetHandler(
            {
                pathParams: { formId: FORM_ID },
                user: { userId: '123e4567-e89b-12d3-a456-426614174099', role: 'admin' },
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
});
