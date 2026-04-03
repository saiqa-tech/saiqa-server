/**
 * CheckOps Form Enricher
 *
 * Converts question UUID strings stored in a form's `questions` array
 * to full question objects before the form is sent to the client.
 *
 * WHY: CheckOps v4 stores form questions as a simple UUID string array in the
 * database.  The saiqa-client expects full `FormQuestion` objects (with
 * questionText, questionType, etc.) so it can render question details and so
 * that Zod schema validation passes on the client side.
 *
 * WHEN TO CALL: After retrieving any form (getForm, createForm, updateForm,
 * duplicate) and before returning `{ data: form }` in the response body.
 *
 * BEHAVIOUR:
 *   - UUID strings  → fetched from question bank (in one batch) and converted
 *                     to { questionId, questionText, questionType, ... }
 *   - Objects that already have `questionText` (legacy inline questions) are
 *     passed through completely unchanged.
 *   - If a UUID cannot be found (question was deleted) a safe placeholder
 *     object is returned so the form can still be loaded.
 *
 * NOTE: `form` is mutated in-place (its `.questions` property is replaced).
 * The same reference is returned for convenience.
 *
 * OVERRIDES (WS3):
 *   Per-form question overrides are stored in `form.metadata.questionOverrides`
 *   (a plain object keyed by questionId UUID).  After enrichment, this function
 *   re-attaches each question's override object as a `.overrides` field on the
 *   enriched question.  The client then applies them via mergeQuestionWithOverrides.
 *
 *   Storing overrides in metadata (rather than inline in the questions JSONB
 *   column) is necessary because CheckOps normalises questions to UUID strings
 *   internally — any inline overrides object would be stripped on write.
 */

/**
 * @param {object} form               - Form object returned by CheckOps (may be a
 *                                      class instance with a `questions` property).
 * @param {object} checkopsWrapper    - Initialised CheckOpsWrapper instance.
 * @returns {Promise<object>}         - The same `form` object with enriched questions.
 */
async function enrichFormQuestions(form, checkopsWrapper) {
    if (!form || !Array.isArray(form.questions) || form.questions.length === 0) {
        return form;
    }

    // Identify questions that are plain UUID strings (they need to be fetched).
    const uuidStrings = form.questions.filter((q) => typeof q === 'string');

    if (uuidStrings.length === 0) {
        // All questions are already objects — nothing to do.
        return form;
    }

    // Batch-fetch all the bank questions.
    let bankQuestionsMap = new Map();
    try {
        const bankQuestions = await checkopsWrapper.getQuestions(uuidStrings);
        // bankQuestions is an array of Question instances; index by id (UUID).
        for (const q of bankQuestions) {
            bankQuestionsMap.set(q.id, q);
        }
    } catch (err) {
        console.error('[enrichFormQuestions] Failed to batch-fetch questions:', err.message);
        // Continue — fall back to placeholder objects below.
    }

    form.questions = form.questions.map((q) => {
        if (typeof q !== 'string') {
            // Already a full object (legacy inline question) — pass through.
            return q;
        }

        const bankQ = bankQuestionsMap.get(q);
        if (bankQ) {
            return {
                questionId: q,                          // bank UUID
                questionText: bankQ.questionText,
                questionType: bankQ.questionType,
                options: bankQ.options ?? undefined,
                validationRules: bankQ.validationRules ?? undefined,
                required: false,                        // form-level field; default false
            };
        }

        // UUID not found — question may have been deleted from the bank.
        console.warn(`[enrichFormQuestions] Question UUID not found in bank: ${q}`);
        return {
            questionId: q,
            questionText: '[Deleted Question]',
            questionType: 'text',
            required: false,
        };
    });

    // Re-attach per-form overrides stored in form.metadata.questionOverrides.
    // These are written by checkops-question-id-mapper.js (create) and
    // checkops-forms-update.step.js (update) to survive CheckOps's internal
    // normalisation of question objects to UUID strings.
    const questionOverrides =
        form.metadata &&
            typeof form.metadata === 'object' &&
            form.metadata.questionOverrides &&
            typeof form.metadata.questionOverrides === 'object'
            ? form.metadata.questionOverrides
            : null;

    if (questionOverrides) {
        form.questions = form.questions.map((q) => {
            const overrides = questionOverrides[q.questionId];
            if (!overrides || typeof overrides !== 'object' || Object.keys(overrides).length === 0) {
                return q;
            }
            return { ...q, overrides };
        });
    }

    return form;
}

module.exports = { enrichFormQuestions };
