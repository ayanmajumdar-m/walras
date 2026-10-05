const connection = require('../config/db');

/**
 * One-time email codes (sign-up verification and password reset).
 * Only a hash of each code is stored — see controllers/auth.controllers.js.
 */
const EmailCode = {
    // Issuing a new code retires any earlier one for the same purpose.
    replace: (userId, purpose, codeHash, minutes, callback) => {
        connection.query('DELETE FROM email_codes WHERE user_id = ? AND purpose = ?', [userId, purpose], (err) => {
            if (err) return callback(err);
            const query = `
            INSERT INTO email_codes (user_id, purpose, code_hash, expires_at)
            VALUES (?, ?, ?, NOW() + CAST(? AS INTEGER) * INTERVAL '1 minute')`;
            connection.query(query, [userId, purpose, codeHash, minutes], callback);
        });
    },

    latest: (userId, purpose, callback) => {
        const query = `
        SELECT id, code_hash, attempts, expires_at, created_at,
               (expires_at > NOW()) AS is_live,
               EXTRACT(EPOCH FROM (NOW() - created_at)) AS age_seconds
        FROM email_codes WHERE user_id = ? AND purpose = ?
        ORDER BY created_at DESC LIMIT 1`;
        connection.query(query, [userId, purpose], callback);
    },

    addAttempt: (id, callback) => {
        connection.query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?', [id], callback);
    },

    clear: (userId, purpose, callback) => {
        connection.query('DELETE FROM email_codes WHERE user_id = ? AND purpose = ?', [userId, purpose], callback);
    }
};

module.exports = EmailCode;
