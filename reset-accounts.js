/**
 * Wipes every user account and everything hanging off one, so the database can
 * start clean under BUTTR ID.
 *
 * Buttr Cloud accounts are now created only by a BUTTR ID sign-in, and a row
 * that predates the integration has no `buttr_sub` and no way to acquire one.
 * Rather than pretend those rows can be migrated, this drops them.
 *
 * THIS DESTROYS DATA — users, wallets, balances, servers, invoices, domain
 * purchases, transactions. It is not part of boot and nothing calls it for you.
 *
 *   node reset-accounts.js --yes-drop-all-accounts
 *
 * Afterwards start the server normally; config/db.js recreates every table in
 * its BUTTR ID shape on the next boot.
 *
 * Not touched: `admins` and `promo_codes`. Admin sign-in is a separate system
 * with its own passwords, and promo codes are not owned by any user.
 */

const { Pool } = require('pg');
const { resolveDbConfig } = require('./config/dbConfig');
require('dotenv').config();

const dbConfig = resolveDbConfig();
const DB_NAME = dbConfig.database;

if (!process.argv.includes('--yes-drop-all-accounts')) {
    console.error(
        'Refusing to run without --yes-drop-all-accounts.\n\n' +
        'This deletes every user, wallet balance, server, invoice and domain\n' +
        'record in ' + (DB_NAME || '(no database configured)') + '. ' +
        'Take a backup first:\n\n' +
        '  pg_dump -h <host> -U <user> -d <database> > backup.sql\n'
    );
    process.exit(1);
}

// A separate connection on purpose: requiring config/db.js would recreate every
// table before we had a chance to drop them.
const pool = new Pool(dbConfig);

// Children first. PostgreSQL has no FOREIGN_KEY_CHECKS switch, so CASCADE on
// the DROP does the same job — and the order still documents what depends on
// what.
const tables = [
    'promo_code_usage',
    'domain_transactions',
    'monthly_invoices',
    'invoices',
    'billing_logs',
    'transactions',
    'wallet_transactions',
    'wallets',
    'servers',
    'user_sessions',
    'users'
];

const run = (sql) => pool.query(sql);

(async () => {
    try {
        console.log(`Resetting accounts in ${DB_NAME}...`);

        for (const table of tables) {
            await run(`DROP TABLE IF EXISTS "${table}" CASCADE`);
            console.log(`  dropped ${table}`);
        }
        console.log('\n✅ Done. Start the server to recreate the tables:  npm start');
    } catch (err) {
        console.error('\n❌ Reset failed:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
