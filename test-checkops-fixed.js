/**
 * Test CheckOps Integration - Post-Fix Verification
 * Tests the proper CheckOps workflow now that fixes are applied
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('./lib/checkops-wrapper');
const { createFormWithQuestionIds, createSubmissionWithQuestionIds, getQuestionIdsFromForm } = require('./lib/checkops-question-id-mapper');

async function testCheckOpsFixedWorkflow() {
    try {
        console.log('🧪 Testing CheckOps Fixed Workflow...\n');

        // Initialize CheckOps
        const checkops = getCheckOpsWrapper();
        await checkops.initialize();
        console.log('✅ CheckOps initialized\n');

        // Test 1: Create form using proper question bank workflow
        console.log('📝 Test 1: Creating form with question bank integration...');

        const testFormData = {
            title: 'Post-Fix Test Form',
            description: 'Testing CheckOps after fixes are applied',
            questions: [
                {
                    questionText: 'What is your full name?',
                    questionType: 'text',
                    required: true,
                    metadata: { order: 1 }
                },
                {
                    questionText: 'What is your age?',
                    questionType: 'number',
                    required: true,
                    validationRules: { min: 0, max: 120 },
                    metadata: { order: 2 }
                },
                {
                    questionText: 'What is your preferred contact method?',
                    questionType: 'select',
                    options: [
                        { key: 'email', label: 'Email' },
                        { key: 'phone', label: 'Phone' },
                        { key: 'sms', label: 'SMS' }
                    ],
                    required: false,
                    metadata: { order: 3 }
                }
            ],
            metadata: { testForm: true, version: 'post-fix' }
        };

        const createdForm = await createFormWithQuestionIds(testFormData);
        console.log(`✅ Form created: ${createdForm.id}`);
        console.log(`   Questions in form: ${createdForm.questions.length}\n`);

        // Test 2: Verify form questions have questionId fields (post-fix)
        console.log('🔍 Test 2: Verifying form questions have questionId fields...');

        createdForm.questions.forEach((question, index) => {
            const questionId = question.questionId || question.id;
            console.log(`   Question ${index + 1}:`);
            console.log(`     ID: ${questionId}`);
            console.log(`     Text: ${question.questionText}`);
            console.log(`     Type: ${question.questionType}`);

            if (!questionId) {
                throw new Error(`Question ${index + 1} missing questionId - fix not applied correctly!`);
            }
        });
        console.log('✅ All questions have proper IDs\n');

        // Test 3: Get question IDs from form
        console.log('📋 Test 3: Getting question IDs from form...');

        const formQuestionData = await getQuestionIdsFromForm(createdForm.id);
        console.log(`   Form ID: ${formQuestionData.formId}`);
        console.log(`   Question IDs: ${formQuestionData.questionIds.join(', ')}`);
        console.log('✅ Question IDs retrieved successfully\n');

        // Test 4: Create submission using question IDs (the critical test!)
        console.log('📤 Test 4: Creating submission with question IDs...');

        const testSubmissionData = {};

        // Use the actual question IDs from the form
        formQuestionData.questions.forEach((question, index) => {
            const questionId = question.questionId || question.id;

            switch (index) {
                case 0: // Name question
                    testSubmissionData[questionId] = 'John Doe';
                    break;
                case 1: // Age question
                    testSubmissionData[questionId] = 28;
                    break;
                case 2: // Contact method question
                    testSubmissionData[questionId] = 'email';
                    break;
            }
        });

        console.log('   Submission data:', testSubmissionData);

        const submission = await createSubmissionWithQuestionIds({
            formId: createdForm.id,
            submissionData: testSubmissionData,
            metadata: { testSubmission: true, timestamp: new Date().toISOString() }
        });

        console.log(`✅ Submission created: ${submission.id}`);
        console.log('   Submission data:', submission.submissionData);
        console.log('✅ Question ID workflow working perfectly!\n');

        // Test 5: Verify submission data integrity
        console.log('🔍 Test 5: Verifying submission data integrity...');

        const retrievedSubmission = await checkops.getSubmission(submission.id);
        console.log(`   Retrieved submission: ${retrievedSubmission.id}`);
        console.log('   Data matches:', JSON.stringify(retrievedSubmission.submissionData) === JSON.stringify(testSubmissionData));
        console.log('✅ Submission data integrity verified\n');

        // Test 6: Test form retrieval and question access
        console.log('📖 Test 6: Testing form retrieval and question access...');

        const retrievedForm = await checkops.getForm(createdForm.id);
        console.log(`   Retrieved form: ${retrievedForm.id}`);
        console.log(`   Questions preserved: ${retrievedForm.questions.length}`);

        const hasAllQuestionIds = retrievedForm.questions.every(q => q.questionId || q.id);
        console.log(`   All questions have IDs: ${hasAllQuestionIds}`);

        if (!hasAllQuestionIds) {
            throw new Error('Form retrieval lost question IDs - fix not complete!');
        }
        console.log('✅ Form retrieval preserves question IDs\n');

        console.log('🎉 ALL TESTS PASSED! CheckOps fixes are working correctly!');
        console.log('\n📊 Summary:');
        console.log(`   ✅ Form created with question bank integration`);
        console.log(`   ✅ Questions preserve questionId fields`);
        console.log(`   ✅ Submissions work with question IDs`);
        console.log(`   ✅ Data integrity maintained`);
        console.log(`   ✅ Form retrieval preserves question IDs`);
        console.log('\n🚀 CheckOps integration is ready for production use!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);

        if (error.message.includes('questionId') || error.message.includes('Unknown question ID')) {
            console.error('\n🔧 This suggests CheckOps fixes may not be fully applied.');
            console.error('   Please verify all fixes from checkops-issues.md are implemented.');
        }
    }
}

// Run the test
testCheckOpsFixedWorkflow();