/**
 * A mysql2-shaped facade over a PostgreSQL pool.
 *
 * Walras Cloud has 132 `connection.query(...)` call sites written against the
 * mysql2 callback API. Rewriting each one by hand would be 132 chances to get
 * a placeholder or a result shape subtly wrong, with no test suite to catch
 * it. Translating at the boundary instead means the port is one file to review
 * rather than a hundred, and the call sites keep working unchanged.
 *
 * What it translates:
 *
 *   ?  ->  $1, $2, ...      positional placeholders
 *   INSERT                  gains RETURNING id, so `result.insertId` still works
 *   UPDATE/DELETE           `result.affectedRows` from rowCount
 *   SELECT                  plain array of rows, as mysql2 returns
 *   23505 (unique)          reported as ER_DUP_ENTRY, which callers check for
 *
 * What it deliberately does not hide: PostgreSQL is stricter about types and
 * quoting than MySQL. This layer makes the *API* compatible, not the dialect.
 */

const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

// A transaction left open this long is rolled back and its client released,
// so a code path that forgets commit/rollback can't hold a connection forever.
const TX_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Rewrites MySQL's `?` placeholders as PostgreSQL's `$n`.
 *
 * Quoted strings are skipped, so a literal question mark inside a value — a
 * URL query string, say — is not mistaken for a placeholder. Dollar-quoting is
 * not handled because nothing here uses it.
 */
const toPositional = (sql) => {
    let out = '';
    let n = 0;
    let quote = null;

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];

        if (quote) {
            out += ch;
            // '' inside a single-quoted string is an escaped quote, not the end.
            if (ch === quote) {
                if (ch === "'" && sql[i + 1] === "'") {
                    out += sql[++i];
                } else {
                    quote = null;
                }
            }
            continue;
        }

        if (ch === "'" || ch === '"') {
            quote = ch;
            out += ch;
            continue;
        }

        out += ch === '?' ? `$${++n}` : ch;
    }

    return out;
};

const firstKeyword = (sql) =>
    sql.replace(/^[\s(]*(?:\/\*[\s\S]*?\*\/|--[^\n]*\n)*\s*/, '').slice(0, 12).trim().split(/\s+/)[0]?.toUpperCase() || '';

/**
 * mysql2 hands back an OkPacket for writes and an array for reads. Callers
 * depend on both shapes — `result.insertId` after an INSERT, `results.length`
 * after a SELECT — so reproduce them rather than returning pg's own object.
 */
const shapeResult = (sql, res) => {
    const kind = firstKeyword(sql);

    if (kind === 'SELECT' || kind === 'WITH' || kind === 'SHOW') {
        return res.rows;
    }

    const ok = {
        affectedRows: res.rowCount,
        changedRows: res.rowCount,
        rowCount: res.rowCount,
        rows: res.rows,
    };
    if (kind === 'INSERT' && res.rows && res.rows.length && res.rows[0].id !== undefined) {
        ok.insertId = res.rows[0].id;
    }
    return ok;
};

/**
 * INSERTs need RETURNING id for `insertId` to mean anything. Skipped when the
 * statement already returns something, or when it is a multi-statement or DDL
 * string where appending would be wrong.
 */
const withReturningId = (sql) => {
    if (firstKeyword(sql) !== 'INSERT') return sql;
    if (/\breturning\b/i.test(sql)) return sql;
    return `${sql.replace(/;\s*$/, '')} RETURNING id`;
};

// PostgreSQL SQLSTATEs mapped to the mysql2 codes the app already branches on.
const ERROR_CODES = {
    '23505': 'ER_DUP_ENTRY',
    '23503': 'ER_NO_REFERENCED_ROW_2',
    '23502': 'ER_BAD_NULL_ERROR',
    '42703': 'ER_BAD_FIELD_ERROR',
    '42701': 'ER_DUP_FIELDNAME',
    '42P07': 'ER_TABLE_EXISTS_ERROR',
    '42P01': 'ER_NO_SUCH_TABLE',
};

const translateError = (err) => {
    if (err && err.code && ERROR_CODES[err.code]) {
        err.sqlState = err.code;
        err.code = ERROR_CODES[err.code];
    }
    return err;
};

const createConnection = (config) => {
    const pool = new Pool(config);

    // A pool re-dials per query, so a database that is down at boot heals on
    // its own once it comes back — unlike the single mysql2 connection this
    // replaces, which stayed dead until the process restarted.
    pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err.code || err.message);
    });

    // A transaction belongs to the request that opened it. beginTransaction
    // runs its callback inside an AsyncLocalStorage context holding the
    // transaction's client; queries issued from that callback chain (the
    // callbacks and promises it creates) run on that client, while queries
    // from any other request keep using the pool. So two requests can each
    // have a transaction open, and one rolling back never undoes another's
    // writes (the old single shared client did both).
    // So issue a transaction's queries from inside the beginTransaction
    // callback (callback style, as every caller does): code after an `await`
    // on a promise-wrapped beginTransaction runs outside it.
    const txStore = new AsyncLocalStorage();

    const run = (sql, params, cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        cb = typeof cb === 'function' ? cb : () => {};

        const text = withReturningId(toPositional(sql));
        const tx = txStore.getStore();
        const runner = (tx && tx.client) || pool;

        runner
            .query(text, params || [])
            .then((res) => cb(null, shapeResult(sql, res)))
            .catch((err) => cb(translateError(err)));
    };

    return {
        query: run,
        execute: run,

        /**
         * Present so existing boot code can call it. A pool connects lazily,
         * so this just proves the database is reachable and reports it the way
         * the mysql2 version did.
         */
        connect(cb) {
            pool.query('SELECT 1')
                .then(() => cb && cb(null))
                .catch((err) => cb && cb(translateError(err)));
        },

        beginTransaction(cb) {
            pool.connect()
                .then(async (client) => {
                    try {
                        await client.query('BEGIN');
                    } catch (err) {
                        client.release(err);
                        return cb(translateError(err));
                    }
                    const tx = { client };
                    tx.timer = setTimeout(() => {
                        if (!tx.client) return;
                        console.error('PostgreSQL transaction left open for 2 minutes; rolling it back.');
                        const c = tx.client;
                        tx.client = null;
                        c.query('ROLLBACK').then(() => c.release()).catch(() => c.release(true));
                    }, TX_TIMEOUT_MS);
                    tx.timer.unref?.();
                    txStore.run(tx, () => cb(null));
                })
                .catch((err) => cb(translateError(err)));
        },

        commit(cb) {
            const tx = txStore.getStore();
            const client = tx && tx.client;
            if (!client) return cb && cb(null);
            tx.client = null;
            clearTimeout(tx.timer);
            client
                .query('COMMIT')
                .then(() => { client.release(); cb && cb(null); })
                .catch((err) => { client.release(err); cb && cb(translateError(err)); });
        },

        rollback(cb) {
            const tx = txStore.getStore();
            const client = tx && tx.client;
            if (!client) return cb && cb();
            tx.client = null;
            clearTimeout(tx.timer);
            client
                .query('ROLLBACK')
                .then(() => { client.release(); cb && cb(); })
                .catch(() => { client.release(true); cb && cb(); });
        },

        end(cb) {
            pool.end().then(() => cb && cb(null)).catch((err) => cb && cb(err));
        },

        on(event, handler) {
            pool.on(event, handler);
            return this;
        },

        pool,
    };
};

module.exports = { createConnection, toPositional, shapeResult, withReturningId };
