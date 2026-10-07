/**
 * SolusVM accounts (Admin → SolusVM accounts), like Fantom's AWS accounts.
 *
 * Walras can run on several SolusVM panels. Each account has:
 *   - its address and API token (the token stored encrypted, utils/secrets.js);
 *   - status: active, or paused (keeps its servers, gets no new ones);
 *   - max servers (null = no limit) and a fill order (lower fills first);
 *   - which Walras locations it serves, with that panel's location id
 *     (solus_account_locations), and which SolusVM plan each Walras plan
 *     creates there (solus_account_plans). Ids differ from panel to panel.
 *
 * A new server goes to the first active account, in fill order, that serves
 * the location, has the plan linked and is under its server limit. Its
 * servers row records the account so it's always managed on that panel.
 */
const connection = require('../config/db');
const solusvm = require('../services/solusvm');
const { encryptSecret, decryptSecret, last4 } = require('./secrets');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

let cache = null;

const load = async () => {
    if (cache && cache.until > Date.now()) return cache.accounts;
    const [rows, links, plans] = await Promise.all([
        q('SELECT * FROM solus_accounts ORDER BY priority, id'),
        q('SELECT account_id, location_id, solus_location_id FROM solus_account_locations'),
        q('SELECT account_id, plan_name, solus_plan_id FROM solus_account_plans'),
    ]);
    const accounts = rows.map((r) => ({
        id: r.id,
        name: r.name,
        apiUrl: r.api_url,
        tokenEncrypted: r.token_encrypted || null,
        tokenLast4: r.token_last4 || null,
        status: r.status,
        maxServers: r.max_servers === null || r.max_servers === undefined ? null : Number(r.max_servers),
        priority: Number(r.priority),
        lastTestAt: r.last_test_at || null,
        lastTestOk: r.last_test_ok === null || r.last_test_ok === undefined ? null : Boolean(r.last_test_ok),
        lastTestError: r.last_test_error || null,
        // Walras location id -> this panel's location id
        locations: Object.fromEntries(links.filter((l) => l.account_id === r.id).map((l) => [Number(l.location_id), Number(l.solus_location_id)])),
        // Walras plan name -> this panel's plan id
        plans: Object.fromEntries(plans.filter((p) => p.account_id === r.id).map((p) => [p.plan_name, Number(p.solus_plan_id)])),
    }));
    cache = { accounts, until: Date.now() + 30 * 1000 };
    return accounts;
};

const forgetAccounts = () => { cache = null; };

/** Every account (no secrets: tokenEncrypted is for internal use only). */
const listAccounts = () => load();

const getAccount = async (id) => (await load()).find((a) => a.id === Number(id)) || null;

/** The SolusVM client for an account. */
const clientForAccount = (account) => {
    if (!account) throw new solusvm.SolusError('This server\'s SolusVM account no longer exists.', 503);
    if (!account.tokenEncrypted) throw new solusvm.SolusError(`SolusVM account "${account.name}" has no API token.`, 503);
    return solusvm.clientFor({ id: account.id, apiUrl: account.apiUrl, token: decryptSecret(account.tokenEncrypted) });
};

const clientForAccountId = async (id) => clientForAccount(await getAccount(id));

/** Servers per account (what "max servers" counts: every server row on it). */
const serverCounts = async () => {
    const rows = await q('SELECT solus_account_id, COUNT(*) AS n FROM servers WHERE solus_account_id IS NOT NULL GROUP BY solus_account_id');
    return new Map(rows.map((r) => [Number(r.solus_account_id), Number(r.n)]));
};

const hasRoom = (a, counts) => a.status === 'active' && (a.maxServers === null || (counts.get(a.id) || 0) < a.maxServers);

/** Accounts that could take a new server of this plan in this location, in fill order. */
const candidates = (accounts, counts, planName, locationId) =>
    accounts.filter((a) => hasRoom(a, counts) && a.tokenEncrypted && a.locations[locationId] && a.plans[planName]);

/** The account a new server goes to, or null when none can take it. */
const pickAccount = async (planName, locationId) => {
    const [accounts, counts] = await Promise.all([load(), serverCounts()]);
    const chosen = candidates(accounts, counts, planName, locationId)[0] || null;
    if (!chosen && accounts.some((a) => a.locations[locationId] && a.plans[planName] && a.status === 'active')) {
        console.warn(`All SolusVM accounts serving location ${locationId} for ${planName} are full. Raise a limit or add an account.`);
    }
    return chosen;
};

/** { [planName]: Set(locationId) } where some account can take a new server now. */
const capacityMap = async () => {
    const [accounts, counts] = await Promise.all([load(), serverCounts()]);
    const out = {};
    for (const a of accounts) {
        if (!hasRoom(a, counts) || !a.tokenEncrypted) continue;
        for (const planName of Object.keys(a.plans)) {
            for (const loc of Object.keys(a.locations)) (out[planName] ||= new Set()).add(Number(loc));
        }
    }
    return out;
};

const anyActive = async () => (await load()).some((a) => a.status === 'active' && a.tokenEncrypted);

// ── Admin writes ───────────────────────────────────────────────────────────

const saveAccount = async (id, fields) => {
    const cols = [];
    const vals = [];
    const put = (col, v) => { cols.push(col); vals.push(v); };
    if (fields.name !== undefined) put('name', fields.name);
    if (fields.apiUrl !== undefined) put('api_url', fields.apiUrl);
    if (fields.token) { put('token_encrypted', encryptSecret(fields.token)); put('token_last4', last4(fields.token)); }
    if (fields.status !== undefined) put('status', fields.status);
    if (fields.maxServers !== undefined) put('max_servers', fields.maxServers);
    if (fields.priority !== undefined) put('priority', fields.priority);
    let accountId = id;
    if (id) {
        if (cols.length) await q(`UPDATE solus_accounts SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`, [...vals, id]);
    } else {
        const ins = await q(`INSERT INTO solus_accounts (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
        accountId = ins.insertId;
    }
    if (fields.locations) {
        await q('DELETE FROM solus_account_locations WHERE account_id = ?', [accountId]);
        for (const [locationId, solusId] of Object.entries(fields.locations)) {
            await q('INSERT INTO solus_account_locations (account_id, location_id, solus_location_id) VALUES (?, ?, ?) RETURNING account_id',
                [accountId, Number(locationId), solusId]);
        }
    }
    if (fields.plans) {
        await q('DELETE FROM solus_account_plans WHERE account_id = ?', [accountId]);
        for (const [planName, solusId] of Object.entries(fields.plans)) {
            await q('INSERT INTO solus_account_plans (account_id, plan_name, solus_plan_id) VALUES (?, ?, ?) RETURNING account_id',
                [accountId, planName, solusId]);
        }
    }
    forgetAccounts();
    solusvm.forgetCatalog(accountId);
    return accountId;
};

const recordTest = async (id, ok, error) => {
    await q('UPDATE solus_accounts SET last_test_at = NOW(), last_test_ok = ?, last_test_error = ? WHERE id = ?', [ok, error ? String(error).slice(0, 300) : null, id]);
    forgetAccounts();
};

const removeAccount = async (id) => {
    await q('DELETE FROM solus_accounts WHERE id = ?', [id]);
    forgetAccounts();
    solusvm.forgetCatalog(id);
};

module.exports = {
    listAccounts,
    getAccount,
    clientForAccount,
    clientForAccountId,
    serverCounts,
    pickAccount,
    capacityMap,
    anyActive,
    saveAccount,
    recordTest,
    removeAccount,
    forgetAccounts,
};
