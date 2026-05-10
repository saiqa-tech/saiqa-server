jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../lib/visibility-engine', () => ({
    buildReportingFilter: jest.fn(),
}));

const { query } = require('../config/database');
const { buildReportingFilter } = require('../lib/visibility-engine');
const { handler: designationPermissionsGetHandler } = require('../steps/designation-permissions-get.step');
const { handler: findingsGetHandler } = require('../steps/checkops-findings-get.step');
const { handler: findingsListHandler } = require('../steps/checkops-findings-list.step');
const { handler: findingsStatsHandler } = require('../steps/checkops-findings-stats.step');
const { handler: submissionsGetHandler } = require('../steps/checkops-submissions-get.step');
const { handler: submissionsListHandler } = require('../steps/checkops-submissions-list.step');

const logger = {
    error: jest.fn(),
};

describe('permission and visibility step handlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CHECKOPS_ENABLED = 'true';
    });

    describe('malformed UUID filters', () => {
        test('submissions list rejects invalid formId with 400 before DB access', async () => {
            const response = await submissionsListHandler(
                {
                    queryParams: { formId: 'not-a-uuid' },
                    user: { userId: 'user-1' },
                },
                { logger }
            );

            expect(response).toEqual({
                status: 400,
                body: { error: 'formId must be a valid UUID' },
            });
            expect(buildReportingFilter).not.toHaveBeenCalled();
            expect(query).not.toHaveBeenCalled();
        });

        test.each([
            [{ formId: 'bad-id' }, 'formId must be a valid UUID'],
            [{ submissionId: 'bad-id' }, 'submissionId must be a valid UUID'],
            [{ questionId: 'bad-id' }, 'questionId must be a valid UUID'],
        ])('findings list rejects %j with 400', async (queryParams, error) => {
            const response = await findingsListHandler(
                {
                    queryParams,
                    user: { userId: 'user-1' },
                },
                { logger }
            );

            expect(response).toEqual({
                status: 400,
                body: { error },
            });
            expect(buildReportingFilter).not.toHaveBeenCalled();
            expect(query).not.toHaveBeenCalled();
        });

        test('findings stats rejects invalid formId with 400 before DB access', async () => {
            const response = await findingsStatsHandler(
                {
                    queryParams: { formId: 'bad-id' },
                    user: { userId: 'user-1' },
                },
                { logger }
            );

            expect(response).toEqual({
                status: 400,
                body: { error: 'formId must be a valid UUID' },
            });
            expect(buildReportingFilter).not.toHaveBeenCalled();
            expect(query).not.toHaveBeenCalled();
        });
    });

    describe('masked not-found responses for out-of-scope resources', () => {
        test('findings get returns 404 when an authorized caller is outside the target unit scope', async () => {
            buildReportingFilter.mockResolvedValueOnce({
                allow: true,
                filterType: 'SELF',
                homeUnitId: 'unit-home',
            });
            query.mockResolvedValueOnce({
                rows: [{ target_unit_id: 'unit-other' }],
            });

            const response = await findingsGetHandler(
                {
                    pathParams: { id: '123e4567-e89b-12d3-a456-426614174000' },
                    user: { userId: 'user-1' },
                },
                { logger }
            );

            expect(response).toEqual({
                status: 404,
                body: { error: 'Finding not found' },
            });
        });

        test('submissions get returns 404 when an authorized caller is outside the target unit scope', async () => {
            buildReportingFilter.mockResolvedValueOnce({
                allow: true,
                filterType: 'SELF',
                homeUnitId: 'unit-home',
            });
            query.mockResolvedValueOnce({
                rows: [{ target_unit_id: 'unit-other' }],
            });

            const response = await submissionsGetHandler(
                {
                    pathParams: { id: '123e4567-e89b-12d3-a456-426614174000' },
                    user: { userId: 'user-1' },
                },
                { logger }
            );

            expect(response).toEqual({
                status: 404,
                body: { error: 'Submission not found' },
            });
        });
    });

    describe('designation permissions matrix materialization', () => {
        test('designation permissions handler returns all six actions with deny-by-default fallbacks', async () => {
            query
                .mockResolvedValueOnce({ rows: [{ id: 'designation-1' }] })
                .mockResolvedValueOnce({
                    rows: [{ action: 'SUBMIT_FORM', allowed: true, scope_type: 'own' }],
                });

            const response = await designationPermissionsGetHandler(
                {
                    pathParams: { designationId: 'designation-1' },
                },
                { logger }
            );

            expect(response.status).toBe(200);
            expect(response.body.permissions).toEqual([
                { action: 'SUBMIT_FORM', allowed: true, scopeType: 'own' },
                { action: 'VIEW_SUBMISSION', allowed: false, scopeType: null },
                { action: 'VIEW_FINDING', allowed: false, scopeType: null },
                { action: 'UPDATE_FINDING', allowed: false, scopeType: null },
                { action: 'VIEW_REPORT', allowed: false, scopeType: null },
                { action: 'MANAGE_FORM', allowed: false, scopeType: null },
            ]);
        });
    });
});