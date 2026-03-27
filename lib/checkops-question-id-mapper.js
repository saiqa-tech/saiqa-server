/**
 * CheckOps v4.0.0 Integration Helper
 * 
 * Key v4.0.0 Behaviors (Verified):
 * - Questions return: { id: UUID, sid: "Q-001", ... }
 * - Forms return: { id: UUID, sid: "FORM-001", questions: [{ questionId: UUID }] }
 * - Submissions require: formId as UUID (SID fails)
 * - Submission data uses: question UUID as key, option key as value
 * - Both UUID and SID work for retrieval (getForm, getQuestion)
 */

const { getCheckOpsWrapper } = require('./checkops-wrapper');

/**
 * Creates questions in the question bank and returns them with UUIDs
 * 
 * @param {Array} questions - Array of question objects
 * @returns {Array} Created questions with id (UUID) and sid (human-readable)
 */
async function createQuestionsInBank(questions) {
    const checkops = getCheckOpsWrapper();
    const createdQuestions = [];

    for (const question of questions) {
        // If the question already has a bank UUID (questionId or id that looks like a
        // UUID), skip creation and reuse the existing bank entry.  This prevents
        // duplicate question-bank entries when FormBuilder sends pre-banked refs.
        const existingId = question.questionId || question.id;
        const isUUID = existingId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingId);
        if (isUUID) {
            console.log(`⏭️  Question already in bank: ${existingId} — skipping creation`);
            createdQuestions.push({
                ...question,
                id: existingId,
                questionId: existingId,
            });
            continue;
        }

        try {
            // Create question in the question bank using CheckOps v4.0.0
            const createdQuestion = await checkops.createQuestion({
                questionText: question.questionText,
                questionType: question.questionType,
                options: question.options || null,
                validationRules: question.validationRules || null,
                metadata: question.metadata || {}
            });

            // Enhanced logging with both UUID and SID
            console.log(`✅ Question created: ${createdQuestion.sid} (${createdQuestion.id})`);

            // Return the question with both IDs
            createdQuestions.push({
                ...question,
                id: createdQuestion.id,           // UUID (for API calls)
                sid: createdQuestion.sid,         // SID (for display)
                questionId: createdQuestion.id,   // UUID (for form references)
                bankQuestionId: createdQuestion.id
            });
        } catch (error) {
            console.error(`❌ Failed to create question: ${question.questionText}`, error.message);
            throw new Error(`Failed to create question: ${question.questionText}`);
        }
    }

    return createdQuestions;
}

/**
 * Creates a form with questions using CheckOps v4.0.0 workflow
 * 
 * v4.0.0 SIMPLIFIED Requirements:
 * - questions array contains UUID strings (not objects!)
 * - Returns form with both id (UUID) and sid (FORM-XXX)
 * 
 * @param {Object} formData - Form data with questions array
 * @returns {Object} Created form with id, sid, and questions array
 */
async function createFormWithQuestionIds(formData) {
    const checkops = getCheckOpsWrapper();

    // Step 1: Create questions in the question bank to get UUIDs
    const questionsWithIds = await createQuestionsInBank(formData.questions);

    // Step 2: Create form with simple UUID array (SIMPLIFIED!)
    const formDataWithQuestionIds = {
        ...formData,
        questions: questionsWithIds.map(q => q.id)  // Simple UUID array!
    };

    const createdForm = await checkops.createForm(formDataWithQuestionIds);

    // Enhanced logging with both UUID and SID
    console.log(`✅ Form created: ${createdForm.sid} (${createdForm.id})`);
    console.log(`   Questions: ${createdForm.questions.length}`);
    console.log(`   Question IDs: ${questionsWithIds.map(q => q.sid).join(', ')}`);

    return createdForm;
}

/**
 * Creates a submission using CheckOps v4.0.0 workflow
 * 
 * v4.0.0 Requirements:
 * - formId MUST be UUID (SID fails with "invalid input syntax for type uuid")
 * - submissionData keys MUST be question UUIDs
 * - submissionData values MUST be option keys (not labels)
 * 
 * @param {Object} submissionData - Submission data
 * @param {string} submissionData.formId - Form UUID (NOT SID!)
 * @param {Object} submissionData.submissionData - Question UUID -> option key mapping
 * @param {Object} submissionData.metadata - Optional metadata
 * @returns {Object} Created submission with id, sid, formId, formSid
 */
async function createSubmissionWithQuestionIds(submissionData) {
    const checkops = getCheckOpsWrapper();
    const { formId, submissionData: rawData, metadata } = submissionData;

    // Validate formId is UUID format (v4.0.0 requirement)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(formId)) {
        throw new Error(`formId must be UUID, got: ${formId}. Use form.id (UUID), not form.sid (SID).`);
    }

    // Create submission with v4.0.0 API
    const submission = await checkops.createSubmission({
        formId,           // UUID required
        submissionData: rawData,  // Question UUID -> option key
        metadata
    });

    // Enhanced logging with both UUID and SID
    console.log(`✅ Submission created: ${submission.sid} (${submission.id})`);
    console.log(`   Form: ${submission.formSid} (${submission.formId})`);
    console.log(`   Questions answered: ${Object.keys(rawData).length}`);

    return submission;
}

/**
 * Gets question IDs from a form (supports both UUID and SID)
 * 
 * v4.0.0 Behavior:
 * - getForm() accepts both UUID and SID
 * - Returns form with questions array containing questionId (UUID)
 * 
 * @param {string} formId - Form UUID or SID
 * @returns {Object} Form info with questionIds array
 */
async function getQuestionIdsFromForm(formId) {
    const checkops = getCheckOpsWrapper();
    const form = await checkops.getForm(formId);

    if (!form || !form.questions) {
        throw new Error(`Form not found or has no questions: ${formId}`);
    }

    // Extract question UUIDs from form
    const questionIds = form.questions
        .filter(q => q.questionId)
        .map(q => q.questionId);

    console.log(`📋 Form ${form.sid} (${form.id}) has ${questionIds.length} questions`);

    return {
        formId: form.id,      // UUID
        formSid: form.sid,    // SID
        questionIds,          // Array of UUIDs
        questions: form.questions
    };
}

module.exports = {
    createQuestionsInBank,
    createFormWithQuestionIds,
    createSubmissionWithQuestionIds,
    getQuestionIdsFromForm
};
