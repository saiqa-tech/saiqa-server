/**
 * Transaction Wrapper for Cross-System Operations
 * Handles transactions that span both CheckOps and saiqa-server
 */

const { getClient } = require('../config/database');
const { getCheckOpsWrapper } = require('./checkops-wrapper');

async function withTransaction(callback) {
    const client = await getClient();
    const checkops = getCheckOpsWrapper();

    try {
        await client.query('BEGIN');
        const result = await callback(client, checkops);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function withCheckOpsTransaction(callback) {
    const checkops = getCheckOpsWrapper();

    if (!checkops.initialized) {
        throw new Error('CheckOps not initialized');
    }

    // Use CheckOps internal transaction if available
    if (checkops.checkops.withTransaction) {
        return await checkops.checkops.withTransaction(callback);
    }

    // Fallback to regular callback
    return await callback(checkops);
}

module.exports = {
    withTransaction,
    withCheckOpsTransaction
};
