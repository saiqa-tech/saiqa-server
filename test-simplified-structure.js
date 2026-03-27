/**
 * Test Simplified CheckOps v4.0.0 Structure
 * 
 * Verifies:
 * 1. Questions array is simple string array (UUIDs)
 * 2. Metadata has no clutter (_version, _createdAt, _questionBankMapping)
 * 3. Everything still works correctly
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('./lib/checkops-wrapper');

async function testSimplifiedStructure() {
    console.log('🧪 Testing Simplified CheckOps v4.0.0 Structure\n');

    const checkops = getCheckOpsWrapper();
    await checkops.initialize();

    try {
        // Test 1: Create question
        console.log('📝 TEST 1: Creating question...');
        const question = await checkops.createQuestion({
            questionText: 'Test Question',
            questionType: 'select',
            options: [
                { key: 'opt_a', label: 'Option A' },
                { key: 'opt_b', label: 'Option B' }
            ]
        });
        console.log(`✅ Question created: ${question.sid} (${question.id})`);

        // Test 2: Create form with simple UUID array
        console.log('\n📋 TEST 2: Creating form with simple UUID array...');
        const form = await checkops.createForm({
            title: 'Simplified Test Form',
            description: 'Testing simplified structure',
            questions: [question.id]  // Simple string UUID!
        });

        console.log(`✅ Form created: ${form.sid} (${form.id})`);
        console.log('\n📊 Form Structure:');
        console.log(JSON.stringify(form, null, 2));

        // Verify structure
        console.log('\n🔍 VERIFICATION:');

        // Check 1: Questions should be simple array
        const isSimpleArray = Array.isArray(form.questions) &&
            form.questions.every(q => typeof q === 'string');
        console.log(`   Questions is simple string array: ${isSimpleArray ? '✅' : '❌'}`);
        if (!isSimpleArray) {
            console.log(`   ERROR: Expected string array, got:`, form.questions);
        }

        // Check 2: Metadata should be clean (no _version, _createdAt, _questionBankMapping)
        const hasClutter = form.metadata._version ||
            form.metadata._createdAt ||
            form.metadata._questionBankMapping;
        console.log(`   Metadata is clean (no clutter): ${!hasClutter ? '✅' : '❌'}`);
        if (hasClutter) {
            console.log(`   ERROR: Found clutter in metadata:`, form.metadata);
        }

        // Test 3: Create submission
        console.log('\n📤 TEST 3: Creating submission...');
        const submission = await checkops.createSubmission({
            formId: form.id,
            submissionData: {
                [question.id]: 'opt_a'
            }
        });
        console.log(`✅ Submission created: ${submission.sid} (${submission.id})`);

        // Test 4: Get stats
        console.log('\n📊 TEST 4: Getting stats...');
        const stats = await checkops.getSubmissionStats(form.id);
        console.log(`✅ Stats retrieved: ${stats.totalSubmissions} submissions`);

        // Final verdict
        console.log('\n' + '='.repeat(70));
        if (isSimpleArray && !hasClutter) {
            console.log('🎉 SUCCESS! Structure is simplified and clean!');
            console.log('\n✅ Questions: Simple UUID array');
            console.log('✅ Metadata: No clutter');
            console.log('✅ Functionality: Working correctly');
        } else {
            console.log('❌ FAILED! Structure still has issues');
            if (!isSimpleArray) console.log('   - Questions array is not simple');
            if (hasClutter) console.log('   - Metadata has clutter');
        }
        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await checkops.close();
    }
}

testSimplifiedStructure().catch(console.error);
