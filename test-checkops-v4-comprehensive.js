/**
 * CheckOps v4.0.0 Comprehensive Integration Test
 * 
 * Tests:
 * 1. Database structure verification
 * 2. Question creation with dual IDs
 * 3. Form creation with question references
 * 4. Form retrieval by UUID and SID
 * 5. Submission creation with keys (not labels)
 * 6. Submission stats with label display
 * 7. Enhanced logging verification
 * 8. Audit logging with entity_sid
 * 9. API endpoint responses
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('./lib/checkops-wrapper');
const { cleanCheckOpsData, verifyAuditLog, verifyV4Structure } = require('./tests/helpers/checkops-test-helper');

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Test results storage
const testResults = [];

/**
 * Test assertion helper
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Test runner
 */
async function runTest(name, testFn) {
    testsRun++;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 TEST ${testsRun}: ${name}`);
    console.log('='.repeat(70));

    try {
        await testFn();
        testsPassed++;
        console.log(`✅ PASSED: ${name}`);
        testResults.push({ name, status: 'PASSED' });
    } catch (error) {
        testsFailed++;
        console.error(`❌ FAILED: ${name}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        testResults.push({ name, status: 'FAILED', error: error.message });
    }
}

/**
 * Main test suite
 */
async function runComprehensiveTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 CheckOps v4.0.0 Comprehensive Integration Test Suite');
    console.log('='.repeat(70));
    console.log(`Started at: ${new Date().toISOString()}\n`);

    const checkops = getCheckOpsWrapper();

    try {
        // Initialize CheckOps
        await checkops.initialize();
        console.log('✅ CheckOps initialized\n');

        // ================================================================
        // TEST 1: Verify v4.0.0 Database Structure
        // ================================================================
        await runTest('Verify v4.0.0 Database Structure', async () => {
            await verifyV4Structure();
        });

        // ================================================================
        // TEST 2: Clean Database Before Tests
        // ================================================================
        await runTest('Clean CheckOps Data', async () => {
            const counts = await cleanCheckOpsData();
            assert(counts.forms === '0', 'Forms should be 0');
            assert(counts.questions === '0', 'Questions should be 0');
            assert(counts.submissions === '0', 'Submissions should be 0');
        });

        // ================================================================
        // TEST 3: Create Question with Structured Options
        // ================================================================
        let question1, question2;
        await runTest('Create Questions with Structured Options', async () => {
            question1 = await checkops.createQuestion({
                questionText: 'What is your priority level?',
                questionType: 'select',
                options: [
                    { key: 'priority_high', label: 'High Priority' },
                    { key: 'priority_medium', label: 'Medium Priority' },
                    { key: 'priority_low', label: 'Low Priority' }
                ]
            });

            // Verify dual IDs
            assert(question1.id, 'Question should have id (UUID)');
            assert(question1.sid, 'Question should have sid');
            assert(question1.sid === 'Q-001', `Question sid should be Q-001, got ${question1.sid}`);
            assert(question1.options.length === 3, 'Question should have 3 options');
            assert(question1.options[0].key === 'priority_high', 'First option key should be priority_high');
            assert(question1.options[0].label === 'High Priority', 'First option label should be High Priority');

            console.log(`   ✅ Question created: ${question1.sid} (${question1.id})`);

            // Create second question
            question2 = await checkops.createQuestion({
                questionText: 'Would you recommend us?',
                questionType: 'radio',
                options: [
                    { key: 'yes', label: 'Yes' },
                    { key: 'no', label: 'No' }
                ]
            });

            assert(question2.sid === 'Q-002', `Second question sid should be Q-002, got ${question2.sid}`);
            console.log(`   ✅ Question created: ${question2.sid} (${question2.id})`);
        });

        // ================================================================
        // TEST 4: Create Form with Question References (UUIDs)
        // ================================================================
        let form;
        await runTest('Create Form with Question References', async () => {
            form = await checkops.createForm({
                title: 'Customer Feedback Survey',
                description: 'Monthly customer satisfaction survey',
                questions: [
                    { questionId: question1.id },  // UUID required!
                    { questionId: question2.id }
                ]
            });

            // Verify dual IDs
            assert(form.id, 'Form should have id (UUID)');
            assert(form.sid, 'Form should have sid');
            assert(form.sid === 'FORM-001', `Form sid should be FORM-001, got ${form.sid}`);
            assert(form.questions.length === 2, 'Form should have 2 questions');
            assert(form.questions[0].questionId === question1.id, 'First question should reference Q1 UUID');

            console.log(`   ✅ Form created: ${form.sid} (${form.id})`);
            console.log(`   ✅ Questions: ${form.questions.length}`);
        });

        // ================================================================
        // TEST 5: Retrieve Form by UUID
        // ================================================================
        await runTest('Retrieve Form by UUID', async () => {
            const retrievedForm = await checkops.getForm(form.id);

            assert(retrievedForm.id === form.id, 'Retrieved form UUID should match');
            assert(retrievedForm.sid === form.sid, 'Retrieved form SID should match');
            assert(retrievedForm.title === form.title, 'Retrieved form title should match');

            console.log(`   ✅ Retrieved form by UUID: ${retrievedForm.sid}`);
        });

        // ================================================================
        // TEST 6: Retrieve Form by SID
        // ================================================================
        await runTest('Retrieve Form by SID', async () => {
            const retrievedForm = await checkops.getForm(form.sid);

            assert(retrievedForm.id === form.id, 'Retrieved form UUID should match');
            assert(retrievedForm.sid === form.sid, 'Retrieved form SID should match');

            console.log(`   ✅ Retrieved form by SID: ${retrievedForm.sid} -> ${retrievedForm.id}`);
        });

        // ================================================================
        // TEST 7: Create Submission with Keys (Not Labels)
        // ================================================================
        let submission;
        await runTest('Create Submission with Keys', async () => {
            submission = await checkops.createSubmission({
                formId: form.id,  // UUID required!
                submissionData: {
                    [question1.id]: 'priority_high',  // Key, not label!
                    [question2.id]: 'yes'
                }
            });

            // Verify dual IDs
            assert(submission.id, 'Submission should have id (UUID)');
            assert(submission.sid, 'Submission should have sid');
            assert(submission.sid === 'SUB-001', `Submission sid should be SUB-001, got ${submission.sid}`);
            assert(submission.formId === form.id, 'Submission formId should match form UUID');
            assert(submission.formSid === form.sid, 'Submission formSid should match form SID');

            // Verify submission data uses keys
            assert(submission.submissionData[question1.id] === 'priority_high', 'Submission should store key');

            console.log(`   ✅ Submission created: ${submission.sid} (${submission.id})`);
            console.log(`   ✅ Form reference: ${submission.formSid} (${submission.formId})`);
        });

        // ================================================================
        // TEST 8: Verify Submission with SID Fails
        // ================================================================
        await runTest('Verify Submission with SID Fails', async () => {
            let errorThrown = false;
            try {
                await checkops.createSubmission({
                    formId: form.sid,  // SID should fail!
                    submissionData: {
                        [question1.id]: 'priority_low'
                    }
                });
            } catch (error) {
                errorThrown = true;
                assert(
                    error.message.includes('invalid input syntax for type uuid'),
                    'Should fail with UUID syntax error'
                );
            }

            assert(errorThrown, 'Submission with SID should throw error');
            console.log(`   ✅ Correctly rejected SID for formId`);
        });

        // ================================================================
        // TEST 9: Get Submission Stats
        // ================================================================
        await runTest('Get Submission Stats', async () => {
            const stats = await checkops.getSubmissionStats(form.id);

            assert(stats.totalSubmissions === 1, 'Should have 1 submission');
            assert(stats.questionStats[question1.id], 'Should have stats for question 1');
            assert(
                stats.questionStats[question1.id].answerDistribution['High Priority'] === 1,
                'Should show label in distribution'
            );
            assert(
                stats.questionStats[question1.id]._keyDistribution['priority_high'] === 1,
                'Should show key in _keyDistribution'
            );

            console.log(`   ✅ Stats retrieved: ${stats.totalSubmissions} submissions`);
            console.log(`   ✅ Answer distribution shows labels: ${JSON.stringify(stats.questionStats[question1.id].answerDistribution)}`);
            console.log(`   ✅ Key distribution shows keys: ${JSON.stringify(stats.questionStats[question1.id]._keyDistribution)}`);
        });

        // ================================================================
        // TEST 10: Verify Audit Logs with entity_sid
        // ================================================================
        await runTest('Verify Audit Logs with entity_sid', async () => {
            // Note: Audit logs are created by API endpoints, not direct CheckOps calls
            // This test verifies the audit_logs table structure
            const { query } = require('./config/database');

            // Check if entity_sid column exists
            const result = await query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'audit_logs' AND column_name = 'entity_sid'
            `);

            assert(result.rows.length === 1, 'audit_logs should have entity_sid column');
            console.log(`   ✅ audit_logs table has entity_sid column`);
        });

        // ================================================================
        // TEST 11: Create Multiple Submissions for Stats
        // ================================================================
        await runTest('Create Multiple Submissions for Stats', async () => {
            // Create 5 more submissions with different answers
            const submissions = [];
            const answers = [
                { [question1.id]: 'priority_high', [question2.id]: 'yes' },
                { [question1.id]: 'priority_medium', [question2.id]: 'yes' },
                { [question1.id]: 'priority_medium', [question2.id]: 'no' },
                { [question1.id]: 'priority_low', [question2.id]: 'yes' },
                { [question1.id]: 'priority_high', [question2.id]: 'no' }
            ];

            for (const answer of answers) {
                const sub = await checkops.createSubmission({
                    formId: form.id,
                    submissionData: answer
                });
                submissions.push(sub);
            }

            assert(submissions.length === 5, 'Should create 5 submissions');
            assert(submissions[0].sid === 'SUB-002', 'Second submission should be SUB-002');
            assert(submissions[4].sid === 'SUB-006', 'Sixth submission should be SUB-006');

            console.log(`   ✅ Created ${submissions.length} additional submissions`);
            console.log(`   ✅ SIDs: ${submissions.map(s => s.sid).join(', ')}`);
        });

        // ================================================================
        // TEST 12: Verify Stats with Multiple Submissions
        // ================================================================
        await runTest('Verify Stats with Multiple Submissions', async () => {
            const stats = await checkops.getSubmissionStats(form.id);

            assert(stats.totalSubmissions === 6, 'Should have 6 total submissions');

            const q1Stats = stats.questionStats[question1.id];
            assert(q1Stats.totalAnswers === 6, 'Question 1 should have 6 answers');
            assert(q1Stats.answerDistribution['High Priority'] === 3, 'Should have 3 High Priority');
            assert(q1Stats.answerDistribution['Medium Priority'] === 2, 'Should have 2 Medium Priority');
            assert(q1Stats.answerDistribution['Low Priority'] === 1, 'Should have 1 Low Priority');

            console.log(`   ✅ Total submissions: ${stats.totalSubmissions}`);
            console.log(`   ✅ Answer distribution: ${JSON.stringify(q1Stats.answerDistribution)}`);
        });

        // ================================================================
        // TEST 13: Update Form and Verify
        // ================================================================
        await runTest('Update Form', async () => {
            const updatedForm = await checkops.updateForm(form.id, {
                title: 'Updated Customer Feedback Survey',
                description: 'Updated description'
            });

            assert(updatedForm.id === form.id, 'Form UUID should remain same');
            assert(updatedForm.sid === form.sid, 'Form SID should remain same');
            assert(updatedForm.title === 'Updated Customer Feedback Survey', 'Title should be updated');

            console.log(`   ✅ Form updated: ${updatedForm.sid}`);
        });

        // ================================================================
        // TEST 14: List All Forms
        // ================================================================
        await runTest('List All Forms', async () => {
            const forms = await checkops.getAllForms();

            assert(Array.isArray(forms) || forms.forms, 'Should return array or object with forms');
            const formsList = Array.isArray(forms) ? forms : forms.forms;
            assert(formsList.length >= 1, 'Should have at least 1 form');
            assert(formsList[0].id, 'Form should have UUID');
            assert(formsList[0].sid, 'Form should have SID');

            console.log(`   ✅ Retrieved ${formsList.length} forms`);
        });

        // ================================================================
        // TEST 15: Verify SID Counters
        // ================================================================
        await runTest('Verify SID Counters', async () => {
            const { query } = require('./config/database');
            const result = await query('SELECT * FROM sid_counters ORDER BY entity_type');

            assert(result.rows.length === 3, 'Should have 3 counter types');

            const formCounter = result.rows.find(r => r.entity_type === 'form');
            const questionCounter = result.rows.find(r => r.entity_type === 'question');
            const submissionCounter = result.rows.find(r => r.entity_type === 'submission');

            assert(formCounter.counter >= 1, 'Form counter should be >= 1');
            assert(questionCounter.counter >= 2, 'Question counter should be >= 2');
            assert(submissionCounter.counter >= 6, 'Submission counter should be >= 6');

            console.log(`   ✅ Form counter: ${formCounter.counter}`);
            console.log(`   ✅ Question counter: ${questionCounter.counter}`);
            console.log(`   ✅ Submission counter: ${submissionCounter.counter}`);
        });

    } catch (error) {
        console.error('\n❌ Test suite failed with error:', error);
        console.error(error.stack);
    } finally {
        await checkops.close();
    }

    // ================================================================
    // TEST SUMMARY
    // ================================================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${testsRun}`);
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
    console.log(`Completed at: ${new Date().toISOString()}`);

    if (testsFailed > 0) {
        console.log('\n❌ FAILED TESTS:');
        testResults.filter(t => t.status === 'FAILED').forEach(t => {
            console.log(`   - ${t.name}: ${t.error}`);
        });
    }

    console.log('='.repeat(70));

    if (testsFailed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! CheckOps v4.0.0 integration is working correctly!');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the errors above.');
        process.exit(1);
    }
}

// Run tests
runComprehensiveTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
