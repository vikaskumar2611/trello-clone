import pg from "pg";
import { DB_NAME } from "../constants.js";

const { Pool } = pg;

// pg Pool reuses connections instead of opening a new one per query
// This is the standard pattern for PostgreSQL in Node.js
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // In production (Railway, Render etc.) SSL is required
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
});

/**
 * Run a single SQL query.
 * This is the main interface used across all controllers.
 *
 * @param {string} text   - SQL query string with $1, $2 placeholders
 * @param {Array}  params - Values to safely inject (prevents SQL injection)
 * @returns {Promise<pg.QueryResult>}
 *
 * Usage in controllers:
 *   const result = await query('SELECT * FROM boards WHERE id = $1', [boardId]);
 *   const board = result.rows[0];
 */
const query = (text, params) => pool.query(text, params);

/**
 * Run multiple queries inside a single transaction.
 * If any query fails, ALL are rolled back automatically.
 *
 * Use this when multiple tables must be updated together.
 * Example: moving a card (update position + log activity)
 *
 * @param {Function} callback - async function that receives client
 * @returns {Promise<any>} - whatever the callback returns
 *
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     await client.query('UPDATE cards SET ...', [...]);
 *     await client.query('INSERT INTO activities ...', [...]);
 *     return someValue;
 *   });
 */
const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error; // re-throw so asyncHandler catches it and passes to errorHandler
    } finally {
        // Always release client back to pool whether success or failure
        client.release();
    }
};

/**
 * Test database connection on app startup.
 * Called from index.js before app.listen()
 */
const connectDB = async () => {
    try {
        const result = await pool.query("SELECT NOW()");
        console.log(
            `PostgreSQL connected: ${result.rows[0].now} | DB: ${DB_NAME}`,
        );
    } catch (error) {
        console.error("PostgreSQL connection FAILED:", error.message);
        process.exit(1); // Exit process if DB unreachable - same pattern as your YouTube clone
    }
};

export { query, withTransaction, connectDB, pool };
