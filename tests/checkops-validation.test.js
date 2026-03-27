/**
 * CheckOps Validation Unit Tests
 */

const {
    validateFormData,
    validateQuestion,
    validateSubmissionData,
    VALID_QUESTION_TYPES,
    OPTION_REQUIRED_TYPES
} = require('../lib/checkops-validation');

describe('CheckOps Validation', () => {
    describe('Form Validation', () => {
        test('should validate valid form data', () => {
            const formData = {
                title: 'Test Form',
                description: 'Test Description',
                questions: [
                    {
                        questionText: 'What is your name?',
                        questionType: 'text',
                        required: true
                    }
                ],
                metadata: {}
            };

            const errors = validateFormData(formData);
            expect(errors).toHaveLength(0);
        });

        test('should reject form without title', () => {
            const formData = {
                description: 'Test Description',
                questions: [
                    {
                        questionText: 'What is your name?',
                        questionType: 'text'
                    }
                ]
            };

            const errors = validateFormData(formData);
            expect(errors).toContain('Title is required and must be a non-empty string');
        });

        test('should reject form with empty title', () => {
            const formData = {
                title: '   ',
                questions: [
                    {
                        questionText: 'What is your name?',
                        questionType: 'text'
                    }
                ]
            };

            const errors = validateFormData(formData);
            expect(errors).toContain('Title is required and must be a non-empty string');
        });

        test('should reject form without questions', () => {
            const formData = {
                title: 'Test Form',
                questions: []
            };

            const errors = validateFormData(formData);
            expect(errors).toContain('Questions must be a non-empty array');
        });

        test('should reject form with invalid question type', () => {
            const formData = {
                title: 'Test Form',
                questions: [
                    {
                        questionText: 'Test question',
                        questionType: 'invalid_type'
                    }
                ]
            };

            const errors = validateFormData(formData);
            expect(errors.some(error => error.includes('questionType must be one of'))).toBe(true);
        });

        test('should reject title exceeding max length', () => {
            const formData = {
                title: 'a'.repeat(256),
                questions: [
                    {
                        questionText: 'Test?',
                        questionType: 'text'
                    }
                ]
            };

            const errors = validateFormData(formData);
            expect(errors).toContain('Title must be 255 characters or less');
        });
    });

    describe('Question Validation', () => {
        test('should validate text question', () => {
            const question = {
                questionText: 'What is your name?',
                questionType: 'text',
                required: true
            };

            const errors = validateQuestion(question, 0);
            expect(errors).toHaveLength(0);
        });

        test('should validate select question with options', () => {
            const question = {
                questionText: 'Choose an option',
                questionType: 'select',
                options: ['Option 1', 'Option 2', 'Option 3'],
                required: false
            };

            const errors = validateQuestion(question, 0);
            expect(errors).toHaveLength(0);
        });

        test('should reject select question without options', () => {
            const question = {
                questionText: 'Choose an option',
                questionType: 'select',
                required: false
            };

            const errors = validateQuestion(question, 0);
            expect(errors.some(error => error.includes('requires a non-empty options array'))).toBe(true);
        });

        test('should validate structured options', () => {
            const question = {
                questionText: 'Choose priority',
                questionType: 'radio',
                options: [
                    { key: 'high', label: 'High Priority' },
                    { key: 'medium', label: 'Medium Priority' },
                    { key: 'low', label: 'Low Priority' }
                ]
            };

            const errors = validateQuestion(question, 0);
            expect(errors).toHaveLength(0);
        });

        test('should reject structured options without key', () => {
            const question = {
                questionText: 'Choose priority',
                questionType: 'radio',
                options: [
                    { label: 'High Priority' }
                ]
            };

            const errors = validateQuestion(question, 0);
            expect(errors.some(error => error.includes('key is required'))).toBe(true);
        });

        test('should validate all option-required types', () => {
            OPTION_REQUIRED_TYPES.forEach(type => {
                const question = {
                    questionText: 'Test question',
                    questionType: type,
                    options: ['Option 1', 'Option 2']
                };

                const errors = validateQuestion(question, 0);
                expect(errors).toHaveLength(0);
            });
        });
    });

    describe('Submission Validation', () => {
        test('should validate valid submission data', () => {
            const submissionData = {
                formId: 'form-123',
                submissionData: {
                    'What is your name?': 'John Doe',
                    'What is your email?': 'john@example.com'
                },
                submittedBy: 'user-456'
            };

            const errors = validateSubmissionData(submissionData);
            expect(errors).toHaveLength(0);
        });

        test('should reject submission without formId', () => {
            const submissionData = {
                submissionData: {
                    'What is your name?': 'John Doe'
                }
            };

            const errors = validateSubmissionData(submissionData);
            expect(errors).toContain('formId is required and must be a string');
        });

        test('should reject submission without submissionData', () => {
            const submissionData = {
                formId: 'form-123'
            };

            const errors = validateSubmissionData(submissionData);
            expect(errors).toContain('submissionData is required and must be an object');
        });

        test('should reject submission with array submissionData', () => {
            const submissionData = {
                formId: 'form-123',
                submissionData: ['invalid', 'array']
            };

            const errors = validateSubmissionData(submissionData);
            expect(errors).toContain('submissionData is required and must be an object');
        });
    });

    describe('Constants Validation', () => {
        test('should have all valid question types', () => {
            expect(VALID_QUESTION_TYPES).toContain('text');
            expect(VALID_QUESTION_TYPES).toContain('textarea');
            expect(VALID_QUESTION_TYPES).toContain('number');
            expect(VALID_QUESTION_TYPES).toContain('email');
            expect(VALID_QUESTION_TYPES).toContain('phone');
            expect(VALID_QUESTION_TYPES).toContain('date');
            expect(VALID_QUESTION_TYPES).toContain('time');
            expect(VALID_QUESTION_TYPES).toContain('datetime');
            expect(VALID_QUESTION_TYPES).toContain('select');
            expect(VALID_QUESTION_TYPES).toContain('multiselect');
            expect(VALID_QUESTION_TYPES).toContain('radio');
            expect(VALID_QUESTION_TYPES).toContain('checkbox');
            expect(VALID_QUESTION_TYPES).toContain('boolean');
            expect(VALID_QUESTION_TYPES).toContain('file');
            expect(VALID_QUESTION_TYPES).toContain('rating');
            expect(VALID_QUESTION_TYPES).toHaveLength(15); // Verify count matches CheckOps
        });

        test('should have correct option-required types', () => {
            expect(OPTION_REQUIRED_TYPES).toContain('select');
            expect(OPTION_REQUIRED_TYPES).toContain('radio');
            expect(OPTION_REQUIRED_TYPES).toContain('checkbox');
            expect(OPTION_REQUIRED_TYPES).toContain('multiselect');
            expect(OPTION_REQUIRED_TYPES).toContain('rating');
            expect(OPTION_REQUIRED_TYPES).toHaveLength(5);
        });
    });
});
