/**
 * Admin → SolusVM accounts (utils/solusAccounts.js), like Fantom's AWS
 * accounts page. Tokens are write-only: never sent back, only their last
 * four characters.
 */
const connection = require('../config/db');
const accounts = require('../utils/solusAccounts');
const solusvm = require('../services/solusvm');
const computeStock = require('../utils/computeStock');
const serverLocations = require('../utils/serverLocations');
const audit = require('../utils/audit');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        console.error(`SolusVM accounts ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const publicAccount = (a, counts) => ({
    id: a.id,
    name: a.name,
    apiUrl: a.apiUrl,
    hasToken: Boolean(a.tokenEncrypted),
    tokenLast4: a.tokenLast4,
    status: a.status,
    maxServers: a.maxServers,
    priority: a.priority,
    servers: counts.get(a.id) || 0,
    lastTestAt: a.lastTestAt,
    lastTestOk: a.lastTestOk,
    lastTestError: a.lastTestError,
    locations: a.locations,
    plans: a.plans,
});

const idMap = (obj, label, validKeys) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (v === null || v === '' || v === undefined) continue;
        if (!validKeys.has(String(k))) continue;
        const id = Number(v);
        if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${label}: choose a valid SolusVM item.`);
        out[k] = id;
    }
    return out;
};

/** Validated fields; `partial` for edits (token optional, kept when empty). */
const readAccount = async (body, { partial = false } = {}) => {
    const out = {};
    const given = (k) => body[k] !== undefined;
    if (!partial || given('name')) {
        out.name = String(body.name || '').trim();
        if (!out.name || out.name.length > 80) throw new HttpError(400, 'Give the account a name (up to 80 characters).');
    }
    if (!partial || given('apiUrl')) {
        out.apiUrl = String(body.apiUrl || '').trim().replace(/\/+$/, '');
        let url;
        try { url = new URL(out.apiUrl); } catch { url = null; }
        if (!url || !/^https?:$/.test(url.protocol) || out.apiUrl.length > 255) {
            throw new HttpError(400, 'Enter the SolusVM panel address, e.g. https://cloud.example.com');
        }
    }
    const token = String(body.token || '').trim();
    if (token) {
        if (token.length > 2000) throw new HttpError(400, 'That API token is too long.');
        out.token = token;
    } else if (!partial) {
        throw new HttpError(400, 'Paste the SolusVM API token.');
    }
    if (given('status')) {
        if (!['active', 'paused'].includes(body.status)) throw new HttpError(400, 'Status must be active or paused.');
        out.status = body.status;
    }
    if (given('maxServers')) {
        if (body.maxServers === null || body.maxServers === '') out.maxServers = null;
        else {
            const n = Number(body.maxServers);
            if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new HttpError(400, 'Max servers must be a whole number, or no limit.');
            out.maxServers = n;
        }
    }
    if (given('priority')) {
        const n = Number(body.priority);
        if (!Number.isInteger(n) || Math.abs(n) > 100000) throw new HttpError(400, 'Fill order must be a whole number.');
        out.priority = n;
    }
    if (given('locations')) {
        const known = new Set((await serverLocations.getLocations({ all: true })).map((l) => String(l.id)));
        out.locations = idMap(body.locations, 'Locations', known);
    }
    if (given('plans')) {
        const known = new Set((await computeStock.getPlans({ all: true })).map((p) => p.name));
        out.plans = idMap(body.plans, 'Plans', known);
    }
    return out;
};

const SolusAccountsController = {
    // GET /api/admin/solus-accounts
    list: handle(async (req, res) => {
        const [list, counts, locs, plans] = await Promise.all([
            accounts.listAccounts(),
            accounts.serverCounts(),
            serverLocations.getLocations({ all: true }),
            computeStock.getPlans({ all: true }),
        ]);
        res.json({
            accounts: list.map((a) => publicAccount(a, counts)),
            locations: locs.map((l) => ({ id: l.id, name: l.name, active: l.active })),
            plans: plans.map((p) => ({ name: p.name, cpu: p.cpu, active: p.active })),
        });
    }),

    // GET /api/admin/solus-accounts/:id/catalog — that panel's locations and plans, for linking
    catalog: handle(async (req, res) => {
        const account = await accounts.getAccount(req.params.id);
        if (!account) throw new HttpError(404, 'Account not found.');
        solusvm.forgetCatalog(account.id);
        try {
            const client = accounts.clientForAccount(account);
            const [locations, plans] = await Promise.all([client.listLocations(), client.listPlans()]);
            res.json({ locations, plans });
        } catch (err) {
            res.json({ error: `Couldn't reach this SolusVM panel: ${err.message}`, locations: [], plans: [] });
        }
    }),

    // POST /api/admin/solus-accounts
    create: handle(async (req, res) => {
        const fields = await readAccount(req.body);
        if (fields.priority === undefined) {
            const list = await accounts.listAccounts();
            fields.priority = list.length ? Math.max(...list.map((a) => a.priority)) + 10 : 10;
        }
        const id = await accounts.saveAccount(null, fields);
        audit(req, 'solus_accounts.create', 'solus_account', id, { name: fields.name, apiUrl: fields.apiUrl, maxServers: fields.maxServers ?? null });
        res.status(201).json({ id, message: `${fields.name} added. Use Test connection to check it.` });
    }),

    // PUT /api/admin/solus-accounts/:id
    update: handle(async (req, res) => {
        const before = await accounts.getAccount(req.params.id);
        if (!before) throw new HttpError(404, 'Account not found.');
        const fields = await readAccount(req.body, { partial: true });
        await accounts.saveAccount(before.id, fields);
        const { token, ...logged } = fields;
        audit(req, 'solus_accounts.update', 'solus_account', before.id, { name: before.name, ...logged, tokenChanged: Boolean(token) });
        res.json({ message: `${fields.name || before.name} saved.` });
    }),

    // POST /api/admin/solus-accounts/:id/test — checks the panel and the links set here
    test: handle(async (req, res) => {
        const account = await accounts.getAccount(req.params.id);
        if (!account) throw new HttpError(404, 'Account not found.');
        solusvm.forgetCatalog(account.id);
        const checks = [];
        let ok = true;
        const check = (label, pass, detail) => { checks.push({ label, ok: pass, detail }); if (!pass) ok = false; };
        try {
            const client = accounts.clientForAccount(account);
            const [plans, locs, os] = await Promise.all([client.listPlans(), client.listLocations(), client.listOsVersions()]);
            check('API token', true, 'Accepted by the panel');
            check('Plans', plans.length > 0, `${plans.length} on the panel`);
            check('Locations', locs.length > 0, `${locs.length} visible on the panel`);
            check('Operating systems', os.length > 0, `${os.length} OS versions`);
            const planIds = new Set(plans.map((p) => p.id));
            const missingPlans = Object.entries(account.plans).filter(([, id]) => !planIds.has(id)).map(([name]) => name);
            check('Linked plans', missingPlans.length === 0,
                missingPlans.length ? `Not on the panel any more: ${missingPlans.join(', ')}` : `${Object.keys(account.plans).length} linked`);
            const locIds = new Set(locs.map((l) => l.id));
            const missingLocs = Object.entries(account.locations).filter(([, id]) => !locIds.has(id)).length;
            check('Linked locations', missingLocs === 0,
                missingLocs ? `${missingLocs} linked location(s) not on the panel any more` : `${Object.keys(account.locations).length} linked`);
        } catch (err) {
            check('Connection', false, err.message);
        }
        await accounts.recordTest(account.id, ok, ok ? null : checks.filter((c) => !c.ok).map((c) => `${c.label}: ${c.detail}`).join('; '));
        res.json({ ok, checks });
    }),

    // DELETE /api/admin/solus-accounts/:id — only without servers
    remove: handle(async (req, res) => {
        const account = await accounts.getAccount(req.params.id);
        if (!account) throw new HttpError(404, 'Account not found.');
        const [{ n }] = await q('SELECT COUNT(*) AS n FROM servers WHERE solus_account_id = ?', [account.id]);
        if (Number(n) > 0) throw new HttpError(409, `${account.name} has ${n} server${Number(n) === 1 ? '' : 's'}. Pause it instead; it keeps its servers but gets no new ones.`);
        await accounts.removeAccount(account.id);
        audit(req, 'solus_accounts.delete', 'solus_account', account.id, { name: account.name });
        res.json({ message: `${account.name} removed.` });
    }),
};

module.exports = SolusAccountsController;
