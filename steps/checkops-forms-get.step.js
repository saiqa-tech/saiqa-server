/**
 * CheckOps Forms - Get Single Form Endpoint
 */

require('dotenv').config();
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const { enrichFormQuestions } = require('../lib/checkops-form-enricher');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const config = {
    emits: [],
    name: 'CheckOpsFormsGet',
    type: 'api',
    path: '/api/checkops/forms/:formId',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, ctx) => {
    try {
        // Check if CheckOps is enabled
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const checkopsWrapper = getCheckOpsWrapper();

        // Ensure CheckOps is initialized
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        const { formId } = req.pathParams;

        if (!formId) {
            return {
                status: 400,
                body: { error: 'Form ID is required' }
            };
        }

        const form = await checkopsWrapper.getForm(formId);

        if (!form) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        // Enrich UUID-string questions to full objects so the client can parse
        // FormResponseSchema without errors.
        await enrichFormQuestions(form, checkopsWrapper);

        // Merge applicability table data into the visibility field so
        // the FormBuilder can load the current configuration when editing.
        // These fields are stored in saiqa-server tables, not in checkops.
        const [designationRows, tagRows] = await Promise.all([
            query(
                'SELECT designation_id FROM form_applicability_designation_map WHERE form_id = $1',
                [formId]
            ),
            query(
                `SELECT td.category, td.value
                 FROM form_applicability_tag_map fatm
                 JOIN tag_definitions td ON td.id = fatm.tag_id
                 WHERE fatm.form_id = $1`,
                [formId]
            )
        ]);

        // Attach the saiqa-server-side fields onto the form's visibility object.
        // After Change 2, form.requireAll is a plain boolean (not form.visibility).
        form.visibility = {
            require_all: form.requireAll ?? true,
            allowedDesignationIds: designationRows.rows.map((r) => r.designation_id),
            requiresTags: tagRows.rows.map((r) => ({ category: r.category, value: r.value }))
        };

        return {
            status: 200,
            body: {
                success: true,
                data: form
            }
        };
    } catch (error) {
        console.error('CheckOps form retrieval failed:', error);

        if (error.message.includes('not found')) {
            return {
                status: 404,
                body: { error: 'Form not found' }
            };
        }

        return {
            status: 500,
            body: {
                error: 'Form retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
