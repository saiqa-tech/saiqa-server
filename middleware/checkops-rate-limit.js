/**
 * CheckOps Rate Limiting Middleware
 * Different limits for different operation types
 */

const rateLimit = require('express-rate-limit');

// Form creation - more restrictive
const createFormLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 form creations per 15 minutes
    message: {
        error: 'Too many form creation requests',
        message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General operations - moderate limits
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
        error: 'Too many CheckOps requests',
        message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Submission operations - balanced limits
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 submissions per 15 minutes
    message: {
        error: 'Too many submission requests',
        message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    createFormLimiter,
    generalLimiter,
    submissionLimiter
};
