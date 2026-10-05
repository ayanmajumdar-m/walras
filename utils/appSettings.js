const connection = require('../config/db');

/**
 * Admin-editable settings stored in app_settings. Reads are cached briefly so
 * every outgoing email does not cost a query; writes clear the cache.
 */
const CACHE_MS = 60 * 1000;
let cache = null;
let cachedAt = 0;

const query = (sql, params) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const getAll = async () => {
    if (cache && Date.now() - cachedAt < CACHE_MS) return cache;
    const rows = await query('SELECT key, value FROM app_settings', []);
    cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    cachedAt = Date.now();
    return cache;
};

const get = async (key) => (await getAll())[key];

const setMany = async (entries) => {
    for (const [key, value] of Object.entries(entries)) {
        await query(
            `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
             RETURNING key`, // explicit RETURNING stops pgCompat appending "RETURNING id"
            [key, value]
        );
    }
    cache = null;
};

module.exports = { get, getAll, setMany };
