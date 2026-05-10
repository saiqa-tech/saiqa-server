jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../lib/scope-recompute', () => ({
    getEffectiveScope: jest.fn(),
}));

const { query } = require('../config/database');
const { getEffectiveScope } = require('../lib/scope-recompute');
const {
    checkCapability,
    getUserScope,
    getFormApplicableUnits,
    buildReportingFilter,
} = require('../lib/visibility-engine');

describe('visibility-engine admin bypass', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('checkCapability allows admin role without permission rows', async () => {
        const result = await checkCapability(null, 'SUBMIT_FORM', { userRole: 'admin' });

        expect(result).toEqual({ allowed: true, scopeType: 'all' });
        expect(query).not.toHaveBeenCalled();
    });

    test('checkCapability allows ADMIN designation without permission rows', async () => {
        query.mockResolvedValueOnce({
            rows: [{ designation_code: 'ADMIN', allowed: null, scope_type: null }],
        });

        const result = await checkCapability('designation-1', 'VIEW_REPORT');

        expect(result).toEqual({ allowed: true, scopeType: 'all' });
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM designations d'), [
            'designation-1',
            'VIEW_REPORT',
        ]);
    });

    test('checkCapability denies when designation exists but the permission row is missing', async () => {
        query.mockResolvedValueOnce({
            rows: [{ designation_code: 'STORE_EMP', allowed: null, scope_type: null }],
        });

        const result = await checkCapability('designation-1', 'VIEW_REPORT');

        expect(result).toEqual({ allowed: false });
        expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM designations d'), [
            'designation-1',
            'VIEW_REPORT',
        ]);
    });

    test('getUserScope returns all active units for admin users', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{ role: 'admin', designation_id: null, unit_id: null, designation_code: null }],
            })
            .mockResolvedValueOnce({
                rows: [{ id: 'unit-1' }, { id: 'unit-2' }],
            });

        const result = await getUserScope('user-1');

        expect(result).toEqual(['unit-1', 'unit-2']);
        expect(getEffectiveScope).not.toHaveBeenCalled();
    });

    test('getFormApplicableUnits returns all active units for admin access', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'unit-1' }, { id: 'unit-2' }],
        });

        const result = await getFormApplicableUnits('form-1', null, { userRole: 'admin' });

        expect(result).toEqual(['unit-1', 'unit-2']);
    });

    test('buildReportingFilter returns ALL for admin users', async () => {
        query.mockResolvedValueOnce({
            rows: [{ role: 'admin', designation_id: null, unit_id: 'home-1', designation_code: null }],
        });

        const result = await buildReportingFilter('user-1', 'VIEW_SUBMISSION');

        expect(result).toEqual({ allow: true, filterType: 'ALL' });
    });

    test('buildReportingFilter denies unknown scope types', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{ role: 'user', designation_id: 'designation-1', unit_id: 'home-1', designation_code: null }],
            })
            .mockResolvedValueOnce({
                rows: [{ designation_code: 'STORE_EMP', allowed: true, scope_type: 'mystery' }],
            });

        const result = await buildReportingFilter('user-1', 'VIEW_SUBMISSION');

        expect(result).toEqual({ allow: false });
        expect(getEffectiveScope).not.toHaveBeenCalled();
    });
});