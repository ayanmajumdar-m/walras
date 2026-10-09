/**
 * The customer's wallet (account balance), created on first use.
 *
 * Several requests can ask for a new customer's wallet at the same moment
 * (the console loads the balance from more than one place), so the insert
 * yields to wallets_user_id_key (config/db.js) instead of creating a second
 * row: two wallets for one customer split credits and debits between them.
 */
const connection = require('../config/db');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

/** The user's wallet row, creating it if there is none. */
const ensureWallet = async (userId) => {
    const [found] = await q('SELECT * FROM wallets WHERE user_id = ? ORDER BY id LIMIT 1', [userId]);
    if (found) return found;
    await q('INSERT INTO wallets (user_id, balance) VALUES (?, 0) ON CONFLICT DO NOTHING', [userId]);
    const [row] = await q('SELECT * FROM wallets WHERE user_id = ? ORDER BY id LIMIT 1', [userId]);
    return row;
};

module.exports = { ensureWallet };
