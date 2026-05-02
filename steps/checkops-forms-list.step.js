/**
 * CheckOps Forms - List Forms Endpoint
 *
 * Returns only forms the requesting user is eligible to see, based on their
 * designation and scope (which store UUIDs they can access).
 *
 * Filtering rules (both must pass):
 *   1. Designation: form has no designation restrictions OR user's designation is in the allowed list.
 *   2. Tags: form has no tag restrictions OR at least one form tag is present on a
 *      unit within the user's scope.
 *
 * Uses a direct SQL query against the `forms` table (shared DB with checkops)
 * rather than going through checkopsWrapper.getAllForms(), because the scope
 * WHERE clause cannot be injected into SQL that lives inside the checkops package.
 */

require('dotenv').config();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getUserScope } = require('../lib/visibility-engine');

const config = {
    emits: [],
    name: 'CheckOpsFormsList',
    type: 'api',
    path: '/api/checkops/forms',
    method: 'GET',
    middleware: [authenticate]
};

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return {
                status: 503,
                body: { error: 'CheckOps is not enabled' }
            };
        }

        const { page = 1, limit = 20, search, isActive } = req.queryParams || {};

        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const offset = (parsedPage - 1) * parsedLimit;

        const userId = req.user.userId;

        // Look up the user's designation_id.  The JWT only carries userId + role.
        const userRes = await query(
            `SELECT u.designation_id,
                    d.code AS designation_code
             FROM users u
             LEFT JOIN designations d ON d.id = u.designation_id
             WHERE u.id = $1`,
            [userId]
        );
        const designationId = userRes.rows.length > 0 ? userRes.rows[0].designation_id : null;
        const designationCode = userRes.rows.length > 0 ? userRes.rows[0].designation_code : null;
        const hasAdminAccess = req.user.role === 'admin' || designationCode === 'ADMIN';

        // Get all store UUIDs this user is authorised to access.
        const scopeUnitIds = hasAdminAccess ? [] : await getUserScope(userId);

        // -----------------------------------------------------------------------
        // Build dynamic WHERE conditions for optional search / isActive filters.
        // $1 = designationId  (may be NULL — SQL handles null as deny-by-default)
        // $2 = scopeUnitIds   (uuid[] — may be empty, ANY('{}'::uuid[]) = false)
        // -----------------------------------------------------------------------
        const params = hasAdminAccess ? [] : [designationId, scopeUnitIds];
        let paramIndex = params.length + 1;
        const whereParts = [];

        if (search) {
            whereParts.push(`f.title ILIKE $${paramIndex}`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (isActive !== undefined) {
            if (isActive !== 'true' && isActive !== 'false') {
                return { status: 400, body: { error: 'isActive must be "true" or "false"' } };
            }
            whereParts.push(`f.is_active = $${paramIndex}`);
            params.push(isActive === 'true');
            paramIndex++;
        }

        // -----------------------------------------------------------------------
        // Core visibility filter:
        //
        // Designation check:
        //   Form has zero rows in form_applicability_designation_map  → open to all designations
        //   Form has rows → user's designation must be listed
        //
        // Tag check:
        //   Form has zero rows in form_applicability_tag_map  → open to all stores
        //   Form has rows → at least one required tag must be present on a unit
        //                   within the user's scope (OR match — strict AND match
        //                   is enforced only at the access-check endpoint)
        // -----------------------------------------------------------------------
        if (!hasAdminAccess) {
            whereParts.unshift(`
                (
                    NOT EXISTS (
                        SELECT 1 FROM form_applicability_designation_map fadm
                        WHERE fadm.form_id = f.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM form_applicability_designation_map fadm
                        WHERE fadm.form_id = f.id AND fadm.designation_id = $1
                    )
                )
                AND (
                    NOT EXISTS (
                        SELECT 1 FROM form_applicability_tag_map fatm
                        WHERE fatm.form_id = f.id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM form_applicability_tag_map fatm
                        JOIN entity_tag_map etm
                            ON etm.tag_id = fatm.tag_id
                            AND etm.entity_type = 'unit'
                            AND etm.entity_id = ANY($2::uuid[])
                        WHERE fatm.form_id = f.id
                    )
                )
            `);
        }

        const whereClause = whereParts.length > 0
            ? `WHERE ${whereParts.join(' AND ')}`
            : '';

        // Count query (no LIMIT / OFFSET)
        const countParams = [...params];
        const countRes = await query(
            `SELECT COUNT(*) AS total FROM forms f ${whereClause}`,
            countParams
        );
        const total = parseInt(countRes.rows[0].total, 10);

        // Data query — add pagination params after all filter params
        const limitParam = paramIndex;
        const offsetParam = paramIndex + 1;
        params.push(parsedLimit, offset);

        const formsRes = await query(
            `SELECT f.*,
                    f.require_all,
                    (
                        EXISTS (SELECT 1 FROM form_applicability_designation_map fadm WHERE fadm.form_id = f.id)
                        OR
                        EXISTS (SELECT 1 FROM form_applicability_tag_map fatm WHERE fatm.form_id = f.id)
                    ) AS is_scoped
             FROM forms f
             ${whereClause}
             ORDER BY f.created_at DESC
             LIMIT $${limitParam} OFFSET $${offsetParam}`,
            params
        );

        // Map database rows to camelCase — same shape checkops Form.toJSON() returns.
        const forms = formsRes.rows.map((row) => ({
            id: row.id,
            sid: row.sid,
            title: row.title,
            description: row.description,
            questions: row.questions,
            metadata: row.metadata,
            visibility: { require_all: row.require_all ?? true },
            isScoped: Boolean(row.is_scoped),
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));

        return {
            status: 200,
            body: {
                success: true,
                data: forms,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit),
                },
            }
        };
    } catch (error) {
        console.error('CheckOps forms list failed:', error);
        return {
            status: 500,
            body: {
                error: 'Forms retrieval failed',
                message: error.message
            }
        };
    }
};

module.exports = { config, handler };
