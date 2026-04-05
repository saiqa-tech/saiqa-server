/**
 * CheckOps Questions - List Questions Endpoint
 */

require('dotenv').config();
const { authenticate } = require('../middleware/auth');
const { getCheckOpsWrapper } = require('../lib/checkops-wrapper');
const db = require('../config/database');

const config = {
    emits: [],
    name: 'CheckOpsQuestionsList',
    type: 'api',
    path: '/api/checkops/questions',
    method: 'GET',
    middleware: [authenticate],
};

/** Map a question_bank row to a plain question object (matches CheckOps Question shape). */
function rowToQuestion(row) {
    return {
        id: row.id,
        sid: row.sid,
        questionText: row.question_text,
        questionType: row.question_type,
        options: row.options,
        validationRules: row.validation_rules,
        metadata: row.metadata,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * Return a Map<questionId, usageCount> for a batch of question IDs.
 * Executes a single SQL statement — one DB round-trip regardless of batch size.
 * The correlated subquery uses the GIN index on forms.questions for each lookup.
 */
async function batchGetUsageCounts(questionIds) {
    if (!questionIds.length) return new Map();
    const result = await db.query(
        `SELECT q_id,
                (SELECT COUNT(*)::int FROM forms
                 WHERE questions @> jsonb_build_array(q_id::text)) AS usage_count
         FROM unnest($1::text[]) AS q_id`,
        [questionIds],
    );
    return new Map(result.rows.map((r) => [r.q_id, r.usage_count]));
}

const handler = async (req, ctx) => {
    try {
        if (process.env.CHECKOPS_ENABLED !== 'true') {
            return { status: 503, body: { error: 'CheckOps is not enabled' } };
        }

        const checkopsWrapper = getCheckOpsWrapper();
        if (!checkopsWrapper.initialized) {
            await checkopsWrapper.initialize();
        }

        const { page = 1, limit = 20, questionType, isActive, search } = req.queryParams || {};

        const parsedPage = Math.max(1, parseInt(page));
        const parsedLimit = Math.min(parseInt(limit), 100);
        const offset = (parsedPage - 1) * parsedLimit;

        // When a text search is requested use a direct SQL query with ILIKE so
        // we are not limited by the CheckOps package's getAllQuestions interface.
        if (search && search.trim()) {
            const whereClauses = ['question_text ILIKE $1'];
            const baseParams = [`%${search.trim()}%`];
            let paramIndex = 2;

            if (questionType) {
                whereClauses.push(`question_type = $${paramIndex++}`);
                baseParams.push(questionType);
            }

            if (isActive !== undefined) {
                whereClauses.push(`is_active = $${paramIndex++}`);
                baseParams.push(isActive === 'true');
            }

            const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

            const [dataResult, countResult] = await Promise.all([
                db.query(
                    `SELECT * FROM question_bank ${whereSQL} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
                    [...baseParams, parsedLimit, offset],
                ),
                db.query(`SELECT COUNT(*) FROM question_bank ${whereSQL}`, baseParams),
            ]);

            const total = parseInt(countResult.rows[0].count, 10);
            const usageCounts = await batchGetUsageCounts(dataResult.rows.map((r) => r.id));

            return {
                status: 200,
                body: {
                    success: true,
                    data: dataResult.rows.map((row) => ({ ...rowToQuestion(row), usageCount: usageCounts.get(row.id) ?? 0 })),
                    pagination: {
                        page: parsedPage,
                        limit: parsedLimit,
                        total,
                        totalPages: Math.ceil(total / parsedLimit),
                    },
                },
            };
        }

        // No search — use the CheckOps wrapper (unchanged path).
        const listOptions = { limit: parsedLimit, offset };
        const countOptions = {};

        if (questionType) {
            listOptions.questionType = questionType;
            countOptions.questionType = questionType;
        }

        if (isActive !== undefined) {
            const isActiveBool = isActive === 'true';
            listOptions.isActive = isActiveBool;
            countOptions.isActive = isActiveBool;
        }

        const [questions, total] = await Promise.all([
            checkopsWrapper.getAllQuestions(listOptions),
            checkopsWrapper.getQuestionCount(countOptions),
        ]);
        const usageCounts = await batchGetUsageCounts(questions.map((q) => q.id));

        return {
            status: 200,
            body: {
                success: true,
                data: questions.map((q) => ({ ...q.toJSON(), usageCount: usageCounts.get(q.id) ?? 0 })),
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages: Math.ceil(total / parsedLimit),
                },
            },
        };
    } catch (error) {
        console.error('CheckOps questions list failed:', error);
        return {
            status: 500,
            body: { error: 'Questions retrieval failed', message: error.message },
        };
    }
};

module.exports = { config, handler };
