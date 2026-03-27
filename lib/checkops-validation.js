/**
 * CheckOps Validation Layer
 * ✅ VERIFIED: All validation types match CheckOps v3.0.0 validation.js
 */

// ✅ VERIFIED: Exact match with CheckOps validation.js
const VALID_QUESTION_TYPES = [
    'text', 'textarea', 'number', 'email', 'phone', 'date', 'time',
    'datetime', 'select', 'multiselect', 'radio', 'checkbox',
    'boolean', 'file', 'rating'
];

// ✅ VERIFIED: Matches CheckOps OptionUtils.requiresOptions()
const OPTION_REQUIRED_TYPES = ['checkbox', 'radio', 'select', 'multiselect', 'rating'];

function validateFormData({ title, description, questions, metadata }) {
    const errors = [];

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        errors.push('Title is required and must be a non-empty string');
    } else if (title.length > 255) {
        errors.push('Title must be 255 characters or less');
    }

    // Validate description
    if (description !== undefined && typeof description !== 'string') {
        errors.push('Description must be a string');
    } else if (description && description.length > 5000) {
        errors.push('Description must be 5000 characters or less');
    }

    // Validate questions
    if (!Array.isArray(questions) || questions.length === 0) {
        errors.push('Questions must be a non-empty array');
    } else {
        questions.forEach((question, index) => {
            const questionErrors = validateQuestion(question, index);
            errors.push(...questionErrors);
        });
    }

    // Validate metadata
    if (metadata !== undefined && (typeof metadata !== 'object' || Array.isArray(metadata))) {
        errors.push('Metadata must be an object');
    }

    return errors;
}

function validateQuestion(question, index) {
    const errors = [];
    const prefix = `Question ${index + 1}`;

    // Validate questionText
    if (!question.questionText || typeof question.questionText !== 'string') {
        errors.push(`${prefix}: questionText is required and must be a string`);
    } else if (question.questionText.length > 500) {
        errors.push(`${prefix}: questionText must be 500 characters or less`);
    }

    // Validate questionType
    if (!question.questionType || !VALID_QUESTION_TYPES.includes(question.questionType)) {
        errors.push(`${prefix}: questionType must be one of: ${VALID_QUESTION_TYPES.join(', ')}`);
    }

    // Validate options for types that require them
    if (OPTION_REQUIRED_TYPES.includes(question.questionType)) {
        if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
            errors.push(`${prefix}: questionType '${question.questionType}' requires a non-empty options array`);
        } else {
            question.options.forEach((option, optionIndex) => {
                if (typeof option === 'string') {
                    // Simple string option - valid
                } else if (typeof option === 'object' && option !== null) {
                    if (!option.key || typeof option.key !== 'string') {
                        errors.push(`${prefix}, Option ${optionIndex + 1}: key is required and must be a string`);
                    }
                    if (!option.label || typeof option.label !== 'string') {
                        errors.push(`${prefix}, Option ${optionIndex + 1}: label is required and must be a string`);
                    }
                } else {
                    errors.push(`${prefix}, Option ${optionIndex + 1}: must be a string or object with key and label`);
                }
            });
        }
    }

    // Validate required field
    if (question.required !== undefined && typeof question.required !== 'boolean') {
        errors.push(`${prefix}: required must be a boolean`);
    }

    // Validate validationRules
    if (question.validationRules !== undefined) {
        if (typeof question.validationRules !== 'object' || Array.isArray(question.validationRules)) {
            errors.push(`${prefix}: validationRules must be an object`);
        }
    }

    return errors;
}

function validateSubmissionData({ formId, submissionData, submittedBy }) {
    const errors = [];

    // Validate formId
    if (!formId || typeof formId !== 'string') {
        errors.push('formId is required and must be a string');
    }

    // Validate submissionData
    if (!submissionData || typeof submissionData !== 'object' || Array.isArray(submissionData)) {
        errors.push('submissionData is required and must be an object');
    }

    // Validate submittedBy (optional)
    if (submittedBy !== undefined && typeof submittedBy !== 'string') {
        errors.push('submittedBy must be a string');
    }

    return errors;
}

module.exports = {
    validateFormData,
    validateQuestion,
    validateSubmissionData,
    VALID_QUESTION_TYPES,
    OPTION_REQUIRED_TYPES
};
