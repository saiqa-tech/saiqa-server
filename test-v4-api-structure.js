/**
 * Test CheckOps v4.0.0 API Structure
 * This script verifies what v4.0.0 actually returns
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('./lib/checkops-wrapper');

async function testV4Structure() {
    console.log('🧪 Testing CheckOps v4.0.0 API Structure\n');

    const checkops = getCheckOpsWrapper();
    await checkops.initialize();

    try {
        // ============================================================
        // TEST 1: Create a question and inspect the response
        // ============================================================
        console.log('📝 TEST 1: Creating a question...');
        const question = await checkops.createQuestion({
            questionText: 'What is your priority level?',
            questionType: 'select',
            options: [
                { key: 'priority_high', label: 'High Priority' },
                { key: 'priority_medium', label: 'Medium Priority' },
                { key: 'priority_low', label: 'Low Priority' }
            ]
        });

        console.log('Question Response Structure:');
        console.log(JSON.stringify(question, null, 2));
        console.log('\nQuestion Fields:');
        console.log('  - id:', question.id, '(type:', typeof question.id, ')');
        console.log('  - sid:', question.sid, '(type:', typeof question.sid, ')');
        console.log('  - options:', JSON.stringify(question.options));

        // ============================================================
        // TEST 2: Create a form and inspect the response
        // ============================================================
        console.log('\n📋 TEST 2: Creating a form...');
        const form = await checkops.createForm({
            title: 'V4 Test Form',
            description: 'Testing v4.0.0 structure',
            questions: [
                { questionId: question.id }  // Try with UUID first
            ]
        });

        console.log('\nForm Response Structure:');
        console.log(JSON.stringify(form, null, 2));
        console.log('\nForm Fields:');
        console.log('  - id:', form.id, '(type:', typeof form.id, ')');
        console.log('  - sid:', form.sid, '(type:', typeof form.sid, ')');
        console.log('  - questions:', JSON.stringify(form.questions, null, 2));

        // ============================================================
        // TEST 3: Retrieve form by UUID
        // ============================================================
        console.log('\n🔍 TEST 3: Retrieving form by UUID...');
        const formByUuid = await checkops.getForm(form.id);
        console.log('Retrieved by UUID - sid:', formByUuid.sid);

        // ============================================================
        // TEST 4: Retrieve form by SID
        // ============================================================
        console.log('\n🔍 TEST 4: Retrieving form by SID...');
        const formBySid = await checkops.getForm(form.sid);
        console.log('Retrieved by SID - id:', formBySid.id);

        // ============================================================
        // TEST 5: Create submission with key (not label)
        // ============================================================
        console.log('\n📤 TEST 5: Creating submission with key...');
        const submission = await checkops.createSubmission({
            formId: form.id,  // Using UUID
            submissionData: {
                [question.id]: 'priority_high'  // Using key, not label
            }
        });

        console.log('\nSubmission Response Structure:');
        console.log(JSON.stringify(submission, null, 2));
        console.log('\nSubmission Fields:');
        console.log('  - id:', submission.id, '(type:', typeof submission.id, ')');
        console.log('  - sid:', submission.sid, '(type:', typeof submission.sid, ')');
        console.log('  - formId:', submission.formId, '(type:', typeof submission.formId, ')');
        console.log('  - formSid:', submission.formSid);
        console.log('  - submissionData:', JSON.stringify(submission.submissionData));
        console.log('  - _rawData:', JSON.stringify(submission._rawData));

        // ============================================================
        // TEST 6: Try creating submission with SID instead of UUID
        // ============================================================
        console.log('\n📤 TEST 6: Creating submission with SID...');
        try {
            const submission2 = await checkops.createSubmission({
                formId: form.sid,  // Using SID instead of UUID
                submissionData: {
                    [question.sid]: 'priority_medium'  // Using SID
                }
            });
            console.log('✅ Submission with SID worked!');
            console.log('  - id:', submission2.id);
            console.log('  - sid:', submission2.sid);
        } catch (error) {
            console.log('❌ Submission with SID failed:', error.message);
        }

        // ============================================================
        // TEST 7: Get submission stats
        // ============================================================
        console.log('\n📊 TEST 7: Getting submission stats...');
        const stats = await checkops.getSubmissionStats(form.id);
        console.log('\nStats Response Structure:');
        console.log(JSON.stringify(stats, null, 2));

        console.log('\n✅ All tests completed!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await checkops.close();
    }
}

testV4Structure().catch(console.error);
