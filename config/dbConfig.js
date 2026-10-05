/**
 * Resolves database connection settings from the environment.
 *
 * One connection string is the preferred form, matching how other services are
 * configured:
 *
 *   DATABASE_URL=postgres://user:password@host:5432/dbname
 *
 * The discrete PG_* / MYSQL_* variables still work as a fallback, so an
 * existing deployment does not have to change everything at once.
 */

const { parse } = require('pg-connection-string');

const env = (...names) => {
    for (const n of names) {
        if (process.env[n]) return process.env[n];
    }
    return undefined;
};

/**
 * TLS policy.
 *
 * Managed providers — Lightsail, RDS — terminate TLS with a CA that is not in
 * a stock container's trust store, so full verification fails with
 * `self-signed certificate in certificate chain`. Encrypted-but-unverified is
 * the default here, which is what the MySQL driver was doing implicitly.
 *
 * Two escape hatches, both explicit:
 *   PG_SSL=false          no TLS at all (a local database)
 *   PG_SSL_STRICT=true    verify the chain (needs the provider's CA installed)
 */
const sslPolicy = () => {
    if ((env('PG_SSL', 'DB_SSL') || '').toLowerCase() === 'false') return false;
    return { rejectUnauthorized: (process.env.PG_SSL_STRICT || '').toLowerCase() === 'true' };
};

const poolTuning = () => ({
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

const resolveDbConfig = () => {
    const url = env('DATABASE_URL', 'PG_DATABASE_URL', 'POSTGRES_URL');

    if (url) {
        const parsed = parse(url);

        /*
          The URL's own sslmode is deliberately not honoured as-is.

          pg-connection-string currently treats `sslmode=require` as
          `verify-full`, so the most natural thing to write in a connection
          string is also the thing that fails against a managed provider. Only
          `sslmode=disable` is taken at face value; everything else defers to
          the policy above, which can still be tightened with PG_SSL_STRICT.
        */
        const ssl = parsed.ssl === false ? false : sslPolicy();

        return {
            host: parsed.host,
            port: Number(parsed.port) || 5432,
            user: parsed.user,
            password: parsed.password,
            database: parsed.database,
            ssl,
            ...poolTuning(),
            _source: 'DATABASE_URL',
            _describe: `${parsed.user}@${parsed.host}:${parsed.port || 5432}/${parsed.database}`,
        };
    }

    const host = env('PG_DB_HOST', 'MYSQL_DB_HOST');
    const port = Number(env('PG_DB_PORT', 'MYSQL_DB_PORT')) || 5432;
    const user = env('PG_DB_USER', 'MYSQL_DB_USER');
    const database = env('PG_DB_NAME', 'MYSQL_DB_NAME');

    return {
        host,
        port,
        user,
        password: env('PG_DB_PASSWORD', 'MYSQL_DB_PASSWORD'),
        database,
        ssl: sslPolicy(),
        ...poolTuning(),
        _source: 'PG_DB_* / MYSQL_DB_*',
        _describe: `${user}@${host}:${port}/${database}`,
    };
};

module.exports = { resolveDbConfig };
