/**
 * CheckOps Finding Validator
 * 
 * Validates finding data against database configuration.
 * Uses strict validation - only configured values are allowed.
 */

const { getConfig } = require('../utils/config');

// Hardcoded fallbacks if database config is not available
const DEFAULT_SEVERITIES = ['Minor', 'Major', 'Critical'];
const DEFAULT_DEPARTMENTS = ['Operations', 'Maintenance', 'Training', 'Equipment', 'Safety', 'Quality Control'];
const DEFAULT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

/**
 * Validate finding creation data
 * @param {object} data - Finding data to validate
 * @returns {Promise<Array<string>>} - Array of validation errors (empty if valid)
 */
async function validateFindingData(data) {
    const errors = [];

    // Required fields
    if (!data.submissionId || typeof data.submissionId !== 'string') {
        errors.push('submissionId is required and must be a UUID');
    }

    if (!data.questionId || typeof data.questionId !== 'string') {
        errors.push('questionId is required and must be a UUID');
    }

    if (!data.formId || typeof data.formId !== 'string') {
        errors.push('formId is required and must be a UUID');
    }

    // Required: observation
    if (!data.observation || typeof data.observation !== 'string' || data.observation.trim() === '') {
        errors.push('observation is required and must be a non-empty string');
    } else if (data.observation.length > 5000) {
        errors.push('observation must be 5000 characters or less');
    }

    // Required: severity
    if (!data.severity || typeof data.severity !== 'string') {
        errors.push('severity is required and must be a string');
    } else {
        const allowedSeverities = await getConfig('finding_severities', DEFAULT_SEVERITIES);
        if (!allowedSeverities.includes(data.severity)) {
            errors.push(`severity must be one of: ${allowedSeverities.join(', ')}`);
        }
    }

    // Required: department
    if (!data.department || typeof data.department !== 'string') {
        errors.push('department is required and must be a string');
    } else {
        const allowedDepartments = await getConfig('finding_departments', DEFAULT_DEPARTMENTS);
        if (!allowedDepartments.includes(data.department)) {
            errors.push(`department must be one of: ${allowedDepartments.join(', ')}`);
        }
    }

    // Optional: rootCause
    if (data.rootCause !== undefined && data.rootCause !== null) {
        if (typeof data.rootCause !== 'string') {
            errors.push('rootCause must be a string');
        } else if (data.rootCause.length > 2000) {
            errors.push('rootCause must be 2000 characters or less');
        }
    }

    // Optional: status (defaults to 'open' if not provided)
    if (data.status !== undefined && data.status !== null) {
        if (typeof data.status !== 'string') {
            errors.push('status must be a string');
        } else {
            const allowedStatuses = await getConfig('finding_statuses', DEFAULT_STATUSES);
            if (!allowedStatuses.includes(data.status)) {
                errors.push(`status must be one of: ${allowedStatuses.join(', ')}`);
            }
        }
    }

    // Optional: evidenceUrls
    if (data.evidenceUrls !== undefined && data.evidenceUrls !== null) {
        if (!Array.isArray(data.evidenceUrls)) {
            errors.push('evidenceUrls must be an array');
        } else {
            data.evidenceUrls.forEach((url, index) => {
                if (typeof url !== 'string') {
                    errors.push(`evidenceUrls[${index}] must be a string`);
                } else if (url.length > 2048) {
                    errors.push(`evidenceUrls[${index}] must be 2048 characters or less`);
                }
            });
        }
    }

    // Optional: assignment
    if (data.assignment !== undefined && data.assignment !== null) {
        if (!Array.isArray(data.assignment)) {
            errors.push('assignment must be an array');
        } else {
            data.assignment.forEach((assign, index) => {
                if (typeof assign !== 'object' || assign === null) {
                    errors.push(`assignment[${index}] must be an object`);
                } else {
                    if (!assign.user_id || typeof assign.user_id !== 'string') {
                        errors.push(`assignment[${index}].user_id is required and must be a string`);
                    }
                    if (!assign.user_name || typeof assign.user_name !== 'string') {
                        errors.push(`assignment[${index}].user_name is required and must be a string`);
                    }
                }
            });
        }
    }

    // Optional: metadata
    if (data.metadata !== undefined && data.metadata !== null) {
        if (typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
            errors.push('metadata must be an object');
        }
    }

    return errors;
}

/**
 * Validate finding update data
 * @param {object} updates - Finding update data
 * @returns {Promise<Array<string>>} - Array of validation errors (empty if valid)
 */
async function validateFindingUpdateData(updates) {
    const errors = [];

    // observation
    if (updates.observation !== undefined) {
        if (typeof updates.observation !== 'string' || updates.observation.trim() === '') {
            errors.push('observation must be a non-empty string');
        } else if (updates.observation.length > 5000) {
            errors.push('observation must be 5000 characters or less');
        }
    }

    // severity
    if (updates.severity !== undefined) {
        if (typeof updates.severity !== 'string') {
            errors.push('severity must be a string');
        } else {
            const allowedSeverities = await getConfig('finding_severities', DEFAULT_SEVERITIES);
            if (!allowedSeverities.includes(updates.severity)) {
                errors.push(`severity must be one of: ${allowedSeverities.join(', ')}`);
            }
        }
    }

    // department
    if (updates.department !== undefined) {
        if (typeof updates.department !== 'string') {
            errors.push('department must be a string');
        } else {
            const allowedDepartments = await getConfig('finding_departments', DEFAULT_DEPARTMENTS);
            if (!allowedDepartments.includes(updates.department)) {
                errors.push(`department must be one of: ${allowedDepartments.join(', ')}`);
            }
        }
    }

    // rootCause
    if (updates.rootCause !== undefined && updates.rootCause !== null) {
        if (typeof updates.rootCause !== 'string') {
            errors.push('rootCause must be a string');
        } else if (updates.rootCause.length > 2000) {
            errors.push('rootCause must be 2000 characters or less');
        }
    }

    // status
    if (updates.status !== undefined && updates.status !== null) {
        if (typeof updates.status !== 'string') {
            errors.push('status must be a string');
        } else {
            const allowedStatuses = await getConfig('finding_statuses', DEFAULT_STATUSES);
            if (!allowedStatuses.includes(updates.status)) {
                errors.push(`status must be one of: ${allowedStatuses.join(', ')}`);
            }
        }
    }

    // evidenceUrls
    if (updates.evidenceUrls !== undefined && updates.evidenceUrls !== null) {
        if (!Array.isArray(updates.evidenceUrls)) {
            errors.push('evidenceUrls must be an array');
        } else {
            updates.evidenceUrls.forEach((url, index) => {
                if (typeof url !== 'string') {
                    errors.push(`evidenceUrls[${index}] must be a string`);
                } else if (url.length > 2048) {
                    errors.push(`evidenceUrls[${index}] must be 2048 characters or less`);
                }
            });
        }
    }

    // assignment
    if (updates.assignment !== undefined && updates.assignment !== null) {
        if (!Array.isArray(updates.assignment)) {
            errors.push('assignment must be an array');
        } else {
            updates.assignment.forEach((assign, index) => {
                if (typeof assign !== 'object' || assign === null) {
                    errors.push(`assignment[${index}] must be an object`);
                } else {
                    if (!assign.user_id || typeof assign.user_id !== 'string') {
                        errors.push(`assignment[${index}].user_id is required and must be a string`);
                    }
                    if (!assign.user_name || typeof assign.user_name !== 'string') {
                        errors.push(`assignment[${index}].user_name is required and must be a string`);
                    }
                }
            });
        }
    }

    // metadata
    if (updates.metadata !== undefined && updates.metadata !== null) {
        if (typeof updates.metadata !== 'object' || Array.isArray(updates.metadata)) {
            errors.push('metadata must be an object');
        }
    }

    return errors;
}

/**
 * Get allowed values for finding fields
 * @returns {Promise<object>}
 */
async function getAllowedFindingValues() {
    const [severities, departments, statuses] = await Promise.all([
        getConfig('finding_severities', DEFAULT_SEVERITIES),
        getConfig('finding_departments', DEFAULT_DEPARTMENTS),
        getConfig('finding_statuses', DEFAULT_STATUSES)
    ]);

    return {
        severities,
        departments,
        statuses
    };
}

module.exports = {
    validateFindingData,
    validateFindingUpdateData,
    getAllowedFindingValues,
    DEFAULT_SEVERITIES,
    DEFAULT_DEPARTMENTS,
    DEFAULT_STATUSES
};
