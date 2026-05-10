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

const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { validateFormData } = require('../lib/checkops-validation');
const { createFormWithQuestionIds } = require('../lib/checkops-question-id-mapper');
const { syncFormApplicability } = require('../lib/form-applicability-sync');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { logAudit } = require('../utils/audit');
const { query } = require('../config/database');
const { handler: formsCreateHandler } = require('../steps/checkops-forms-create.step');
const { handler: formsUpdateHandler } = require('../steps/checkops-forms-update.step');

describe('checkops form write safety', () => {
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
        wrapper.deleteForm.mockResolvedValue(undefined);
        query.mockResolvedValue({ rows: [] });
    });

    test('create attempts compensating delete and returns 500 when applicability sync fails', async () => {
        createFormWithQuestionIds.mockResolvedValue({
            id: '123e4567-e89b-12d3-a456-426614174000',
            sid: 'FORM-001',
            questions: [],
            metadata: {},
        });
        syncFormApplicability.mockRejectedValue(new Error('sync failed'));

        const response = await formsCreateHandler(
            {
                body: {
                    title: 'Test Form',
                    description: 'Desc',
                    questions: [],
                    metadata: {},
                    visibility: { require_all: false, allowedDesignationIds: ['desig-1'] },
                },
                user: { userId: 'user-1' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        expect(createFormWithQuestionIds).toHaveBeenCalledTimes(1);
        expect(syncFormApplicability).toHaveBeenCalledWith(
            '123e4567-e89b-12d3-a456-426614174000',
            { require_all: false, allowedDesignationIds: ['desig-1'] }
        );
        expect(wrapper.deleteForm).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
        expect(response).toEqual({
            status: 500,
            body: {
                error: 'Form creation failed',
                message: 'sync failed',
            },
        });
        expect(enrichFormQuestions).not.toHaveBeenCalled();
        expect(logAudit).not.toHaveBeenCalled();
    });

    test('update returns 200 with warning when applicability sync fails (no fake rollback)', async () => {
        wrapper.updateForm.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            sid: 'FORM-001',
            requireAll: true,
        });
        enrichFormQuestions.mockResolvedValue(undefined);
        syncFormApplicability.mockRejectedValue(new Error('sync failed'));
        logAudit.mockResolvedValue(undefined);

        const response = await formsUpdateHandler(
            {
                pathParams: { formId: '123e4567-e89b-12d3-a456-426614174000' },
                body: {
                    title: 'Updated Form',
                    visibility: { require_all: true },
                },
                user: { userId: 'user-1' },
                headers: {},
            },
            { logger: { error: jest.fn() } }
        );

        // The form update itself should succeed — only applicability sync failed.
        expect(wrapper.updateForm).toHaveBeenCalledTimes(1);
        expect(wrapper.updateForm).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', {
            title: 'Updated Form',
            requireAll: true,
        });
        expect(syncFormApplicability).toHaveBeenCalledWith(
            '123e4567-e89b-12d3-a456-426614174000',
            { require_all: true }
        );

        // No fake rollback — updateForm should NOT be called a second time.
        // No getForm prefetch needed either (no rollback to prepare for).
        expect(wrapper.getForm).not.toHaveBeenCalled();

        // Response is 200 with the saved data + a warning, not a 500.
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(response.body.warning).toMatch(/visibility restrictions failed to sync/);
        expect(response.body.syncError).toBe('sync failed');
    });
});