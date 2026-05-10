/**
 * Form visibility object builder.
 *
 * Creates and validates the `visibility` field that is merged into every form
 * response (GET, POST, PUT) before the response is sent to the client.
 *
 * The visibility field is a server-side construct that merges data from three
 * separate sources:
 *   - require_all      → checkops forms.require_all column
 *   - designationIds   → form_applicability_designation_map rows
 *   - tagEntries       → form_applicability_tag_map + tag_definitions rows
 *
 * Parsing the result against the shared FormVisibilitySchema ensures the server
 * cannot silently send a shape the client cannot parse.  Any future contract
 * change (key rename, added field) will throw here at test time rather than
 * silently breaking the form builder on the client.
 */

'use strict';

const { FormVisibilitySchema } = require('@saiqa-tech/contracts');

/**
 * Build a validated form visibility object for inclusion in a form response body.
 *
 * @param {object} options
 * @param {boolean|null|undefined} options.requireAll   - Value of forms.require_all.
 *                                                        Defaults to true when falsy.
 * @param {string[]}               options.designationIds - Designation UUIDs from
 *                                                        form_applicability_designation_map.
 * @param {{ category: string, value: string }[]} options.tagEntries - Tag entries from
 *                                                        form_applicability_tag_map.
 * @returns {{ require_all: boolean, allowedDesignationIds: string[], requiresTags: { category: string, value: string }[] }}
 * @throws {ZodError} If the resulting shape does not match the shared contract.
 */
function buildFormVisibility({ requireAll, designationIds = [], tagEntries = [] }) {
    return FormVisibilitySchema.parse({
        require_all: requireAll ?? true,
        allowedDesignationIds: designationIds,
        requiresTags: tagEntries,
    });
}

module.exports = { buildFormVisibility };
