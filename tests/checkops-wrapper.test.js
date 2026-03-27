/**
 * CheckOps Wrapper Unit Tests
 */

const { CheckOpsWrapper, getCheckOpsWrapper } = require('../lib/checkops-wrapper');

describe('CheckOps Wrapper', () => {
    let wrapper;

    beforeEach(() => {
        wrapper = new CheckOpsWrapper();
    });

    describe('Initialization', () => {
        test('should create wrapper instance', () => {
            expect(wrapper).toBeInstanceOf(CheckOpsWrapper);
            expect(wrapper.initialized).toBe(false);
        });

        test('should throw error when not initialized', () => {
            expect(() => wrapper._ensureInitialized()).toThrow('CheckOps wrapper not initialized');
        });

        test('should have all required methods', () => {
            const expectedMethods = [
                // Forms
                'createForm', 'getForm', 'getAllForms', 'updateForm', 'deleteForm',
                'deactivateForm', 'activateForm', 'getFormCount',
                // Questions
                'createQuestion', 'getQuestion', 'getQuestions', 'getAllQuestions',
                'updateQuestion', 'deleteQuestion', 'deactivateQuestion', 'activateQuestion', 'getQuestionCount',
                // Submissions
                'createSubmission', 'getSubmission', 'getSubmissionsByForm', 'getAllSubmissions',
                'updateSubmission', 'deleteSubmission', 'getSubmissionCount', 'getSubmissionStats',
                // Options
                'updateOptionLabel', 'getOptionHistory',
                // Monitoring
                'getMetrics', 'getProductionMetrics', 'getHealthCheckData', 'getHealthStatus'
            ];

            expectedMethods.forEach(method => {
                expect(typeof wrapper[method]).toBe('function');
            });
        });
    });

    describe('Singleton Pattern', () => {
        test('should return same instance', () => {
            const instance1 = getCheckOpsWrapper();
            const instance2 = getCheckOpsWrapper();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Metrics', () => {
        test('should track metrics', () => {
            const metrics = wrapper.getMetrics();
            expect(metrics).toHaveProperty('operations');
            expect(metrics).toHaveProperty('errors');
            expect(metrics).toHaveProperty('initialized');
            expect(metrics.operations).toBe(0);
            expect(metrics.errors).toBe(0);
            expect(metrics.initialized).toBe(false);
        });
    });

    describe('Health Status', () => {
        test('should return uninitialized status', async () => {
            const health = await wrapper.getHealthStatus();
            expect(health.status).toBe('uninitialized');
            expect(health.healthy).toBe(false);
        });
    });

    describe('Method Validation', () => {
        test('should throw error for uninitialized form operations', async () => {
            await expect(wrapper.createForm({})).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.getForm('test-id')).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.getAllForms()).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.updateForm('id', {})).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.deleteForm('id')).rejects.toThrow('CheckOps wrapper not initialized');
        });

        test('should throw error for uninitialized question operations', async () => {
            await expect(wrapper.createQuestion({})).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.getQuestion('test-id')).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.getAllQuestions()).rejects.toThrow('CheckOps wrapper not initialized');
        });

        test('should throw error for uninitialized submission operations', async () => {
            await expect(wrapper.createSubmission({})).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.getSubmission('test-id')).rejects.toThrow('CheckOps wrapper not initialized');
            await expect(wrapper.getAllSubmissions()).rejects.toThrow('CheckOps wrapper not initialized');
        });
    });
});
