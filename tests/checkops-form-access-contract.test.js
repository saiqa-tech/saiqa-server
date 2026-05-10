jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../lib/visibility-engine', () => ({
    checkCapability: jest.fn(),
    getUserScope: jest.fn(),
    getFormApplicableUnits: jest.fn(),
    computeEligibleUnits: jest.fn(),
    resolveSubmissionEntry: jest.fn(),
}));

const { FormAccessResponseSchema } = require('@saiqa-tech/contracts');
const { query } = require('../config/database');
const {
    checkCapability,
    getUserScope,
    getFormApplicableUnits,
    computeEligibleUnits,
    resolveSubmissionEntry,
} = require('../lib/visibility-engine');
const { handler } = require('../steps/checkops-form-access.step');

describe('checkops form access contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CHECKOPS_ENABLED = 'true';
    });

    test('denied responses still return the full shared contract shape', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ exists: true }] })
            .mockResolvedValueOnce({
                rows: [{ designation_id: null, designation_code: null }],
            });

        const response = await handler(
            {
                pathParams: { formId: '123e4567-e89b-12d3-a456-426614174000' },
                user: { userId: 'user-1', role: 'user' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        expect(FormAccessResponseSchema.parse(response.body)).toEqual({
            canView: true,
            canSubmit: false,
            requiresUnitSelection: false,
            defaultUnitId: null,
            defaultUnitName: null,
            eligibleUnits: [],
            reason: 'Your account has no job designation assigned. Contact an administrator.',
        });
    });

    test('allowed responses return the shared contract with single-store defaults', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ exists: true }] })
            .mockResolvedValueOnce({
                rows: [{ designation_id: 'designation-1', designation_code: 'MANAGER' }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 'unit-1', name: 'Store A', code: 'A1' }],
            });
        checkCapability.mockResolvedValue({ allowed: true });
        getUserScope.mockResolvedValue(['unit-1']);
        getFormApplicableUnits.mockResolvedValue(['unit-1']);
        computeEligibleUnits.mockReturnValue(['unit-1']);
        resolveSubmissionEntry.mockReturnValue({
            canSubmit: true,
            requiresUnitSelection: false,
            defaultUnitId: 'unit-1',
        });

        const response = await handler(
            {
                pathParams: { formId: '123e4567-e89b-12d3-a456-426614174000' },
                user: { userId: 'user-1', role: 'manager' },
            },
            { logger: { error: jest.fn() } }
        );

        expect(response.status).toBe(200);
        expect(FormAccessResponseSchema.parse(response.body)).toEqual({
            canView: true,
            canSubmit: true,
            requiresUnitSelection: false,
            defaultUnitId: 'unit-1',
            defaultUnitName: 'Store A',
            eligibleUnits: [{ id: 'unit-1', name: 'Store A', code: 'A1' }],
            reason: null,
        });
    });
});