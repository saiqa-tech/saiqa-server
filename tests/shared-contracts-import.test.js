const {
    ApiErrorSchema,
    DesignationActionSchema,
    DesignationPermissionSchema,
    FindingTargetingFieldsSchema,
    ScopeTypeSchema,
    SubmissionTargetingFieldsSchema,
    UserRoleSchema,
    createPaginatedResponseSchema,
} = require('@saiqa-tech/contracts');

describe('shared contracts package', () => {
    test('loads shared schemas through the server CommonJS runtime', () => {
        expect(UserRoleSchema.parse('admin')).toBe('admin');
        expect(ScopeTypeSchema.parse('own')).toBe('own');
        expect(ApiErrorSchema.parse({ error: 'forbidden' })).toEqual({
            error: 'forbidden',
        });

        const schema = createPaginatedResponseSchema(ApiErrorSchema);
        expect(
            schema.parse({
                data: [{ error: 'invalid' }],
                pagination: { page: 1, limit: 20, total: 1 },
            })
        ).toEqual({
            data: [{ error: 'invalid' }],
            pagination: { page: 1, limit: 20, total: 1 },
        });
    });

    test('submission targeting fields accept null values through CJS', () => {
        const result = SubmissionTargetingFieldsSchema.parse({
            targetUnitId: null,
            submitterUserId: null,
            targetUnitName: null,
        });
        expect(result.targetUnitId).toBeNull();
        expect(result.submitterUserId).toBeNull();
    });

    test('finding targeting fields accept null values and have no submitterUserId', () => {
        const result = FindingTargetingFieldsSchema.parse({
            targetUnitId: null,
            targetUnitName: null,
        });
        expect(result.targetUnitId).toBeNull();
        expect('submitterUserId' in FindingTargetingFieldsSchema.shape).toBe(false);
    });

    test('designation permission schema accepts null scopeType for deny-by-default rows', () => {
        const result = DesignationPermissionSchema.parse({
            action: 'SUBMIT_FORM',
            allowed: false,
            scopeType: null,
        });
        expect(result.scopeType).toBeNull();

        // All 6 valid actions must parse
        for (const action of DesignationActionSchema.options) {
            expect(() =>
                DesignationPermissionSchema.parse({ action, allowed: true, scopeType: 'own' })
            ).not.toThrow();
        }
    });
});