/**
 * Virtual Machines: servers created on SolusVM (services/solusvm.js) and sold
 * against the stock admins set per plan and location (utils/computeStock.js).
 *
 * Deploying is a chain of single, atomic steps rather than one transaction,
 * because the middle step is a call to SolusVM: take a unit of stock, charge
 * the first hour, create the server row, then create the VM. If a later step
 * fails, the earlier ones are undone (stock returned, charge refunded).
 */
const connection = require('../config/db');
const solusvm = require('../services/solusvm');
const stock = require('../utils/computeStock');
const serverLocations = require('../utils/serverLocations');
const solusAccounts = require('../utils/solusAccounts');
const billing = require('../utils/monthlyBilling');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

const handle = (label, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
        if (err instanceof solusvm.SolusError) {
            console.error(`${label} (SolusVM) failed:`, err.message);
            return res.status(502).json({ error: 'Virtual Machines are temporarily unavailable. Please try again shortly.' });
        }
        console.error(`${label} failed:`, err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// RFC 1123 hostname: labels of letters, digits and hyphens (100 characters max, the column size).
const HOSTNAME = /^(?=.{1,100}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

const validPassword = (p) =>
    typeof p === 'string' && p.length >= 10 && p.length <= 72 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && !/\s/.test(p);

// ── Catalogue ──────────────────────────────────────────────────────────────

// OS choices: every OS (by name, e.g. "Ubuntu 22.04") offered by an active
// SolusVM account. Names, not ids: each panel numbers its images differently.
const osNames = async () => {
    const names = new Set();
    for (const a of await solusAccounts.listAccounts()) {
        if (a.status !== 'active' || !a.tokenEncrypted) continue;
        try {
            (await solusAccounts.clientForAccount(a).listOsVersions()).forEach((o) => names.add(o.name));
        } catch (err) {
            console.warn(`OS list from SolusVM account ${a.id} failed:`, err.message);
        }
    }
    return [...names].sort();
};

// GET /api/servers/catalog — plans with prices, where each is in stock, and the OS choices.
exports.getCatalog = handle('Compute catalogue', async (req, res) => {
    const [availability, active, places, os] = await Promise.all([
        stock.getAvailability(), stock.getPlans(), serverLocations.getLocations(), osNames(),
    ]);
    // Locations from Admin → Locations; one no SolusVM account serves yet is
    // marked comingSoon (listed, not orderable).
    const served = new Set();
    for (const a of await solusAccounts.listAccounts()) {
        if (a.status === 'active') Object.keys(a.locations).forEach((id) => served.add(Number(id)));
    }
    const locations = places.map((l) => ({ id: l.id, name: l.name, country: l.country, comingSoon: !served.has(l.id) }));
    const plans = active.map(({ id, active: _a, sortOrder: _s, ...p }) => ({
        ...p,
        hourly: stock.hourlyRupees(p),
        locations: Object.keys(availability[p.name] || {}).map(Number),
    }));
    res.json({ enabled: plans.some((p) => p.locations.length > 0), plans, locations, os: os.map((name) => ({ id: name, name })) });
});

// ── Deploy ─────────────────────────────────────────────────────────────────

// POST /api/servers/deploy { plan, location, os, hostname, password }
exports.deployServer = handle('Deploy server', async (req, res) => {
    const userId = req.user.userId;
    const planName = typeof req.body.plan === 'string' ? req.body.plan : req.body.plan?.name;
    const locationId = Number(req.body.location);
    const osName = String(req.body.os || '').trim();
    const hostname = String(req.body.hostname || '').trim().toLowerCase();
    const password = req.body.password;

    // Active plans only: a hidden plan can't be bought, whatever the browser sends.
    const plan = typeof planName === 'string' ? await stock.findPlan(planName) : null;
    if (!plan) throw new HttpError(400, 'Choose a plan.');
    if (!Number.isInteger(locationId)) throw new HttpError(400, 'Choose a location.');
    if (!osName || osName.length > 80) throw new HttpError(400, 'Choose an operating system.');
    if (!HOSTNAME.test(hostname)) throw new HttpError(400, 'Enter a valid hostname, e.g. web1 or app.example.com.');
    if (!validPassword(password)) {
        throw new HttpError(400, 'Use a root password of 10 to 72 characters with upper and lower case letters and a number, and no spaces.');
    }

    const outOfStock = () => new HttpError(409, `${plan.name} is out of stock in that location.`, { outOfStock: true });
    const location = await serverLocations.findLocation(locationId);
    if (!location) throw new HttpError(400, 'Choose a location.');

    // The SolusVM account it goes on: first active one, in fill order, that
    // serves this location, has the plan linked and is under its limit.
    const account = await solusAccounts.pickAccount(plan.name, location.id);
    if (!account) throw outOfStock();
    const client = solusAccounts.clientForAccount(account);
    const osVersion = (await client.listOsVersions()).find((o) => o.name === osName);
    if (!osVersion) throw new HttpError(400, `${osName} isn't available in ${location.name}. Choose another operating system.`);

    // Postpaid (utils/monthlyBilling.js): nothing is charged now; the server is
    // billed pro rata on the 1st. No new servers while an invoice is overdue.
    if (await billing.hasOverdue(userId)) {
        throw new HttpError(402, 'You have an overdue invoice. Pay it in Billing → Invoices to create new servers.', { overdue: true });
    }
    const hourly = stock.hourlyRupees(plan);

    // 1. Take a unit of stock.
    if (!(await stock.reserve(plan.name, locationId))) throw outOfStock();

    const undo = async (serverId) => {
        await stock.release(plan.name, locationId).catch((e) => console.error('Deploy stock return failed:', e.message));
        if (serverId) await q('DELETE FROM servers WHERE id = ?', [serverId]).catch(() => {});
    };

    // 2. Our record of the server.
    let serverId;
    try {
        const ins = await q(
            `INSERT INTO servers (user_id, name, hostname, location, location_id, solus_account_id, os, plan_name, monthly_cost, hourly_cost, currency, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'deploying')`,
            [userId, hostname, hostname, location.name, location.id, account.id, osVersion.name.slice(0, 50), plan.name, plan.monthly, hourly],
        );
        serverId = ins.insertId;
    } catch (err) {
        await undo(null);
        throw err;
    }

    // 3. The VM itself.
    let vm;
    try {
        vm = await client.createServer({
            name: hostname, planId: account.plans[plan.name], locationId: account.locations[location.id], osVersionId: osVersion.id, password,
        });
    } catch (err) {
        await undo(serverId);
        if (err instanceof solusvm.SolusError && err.status === 422) {
            throw new HttpError(400, `SolusVM refused the server: ${err.message}`);
        }
        console.error(`SolusVM create failed on account ${account.id}:`, err.message);
        throw new HttpError(502, "We couldn't create your server right now. You haven't been charged; please try again shortly.");
    }

    await q('UPDATE servers SET solus_server_id = ?, status = ?, ip_address = ? WHERE id = ?',
        [vm.id, solusvm.walrasStatus(vm), solusvm.primaryIp(vm), serverId]);
    // 4. Billing starts now (pro rata on next month's invoice).
    await billing.startUsage({ id: serverId, userId, hostname, planName: plan.name, monthlyRupees: plan.monthly })
        .catch((e) => console.error(`Billing record for server ${serverId} failed:`, e.message));

    res.status(201).json({ message: 'Server is being created', serverId });
});

// ── List / manage / delete ─────────────────────────────────────────────────

// Refresh servers still being built from SolusVM (status and IP address).
const syncDeploying = async (servers) => {
    const pending = servers.filter((s) => s.solus_server_id && s.solus_account_id && s.status === 'deploying');
    await Promise.all(pending.map(async (s) => {
        try {
            const vm = await (await solusAccounts.clientForAccountId(s.solus_account_id)).getServer(s.solus_server_id);
            const status = solusvm.walrasStatus(vm);
            const ip = solusvm.primaryIp(vm) || s.ip_address;
            if (status !== s.status || ip !== s.ip_address) {
                await q('UPDATE servers SET status = ?, ip_address = ? WHERE id = ?', [status, ip, s.id]);
                Object.assign(s, { status, ip_address: ip });
            }
        } catch (err) {
            console.warn(`Server ${s.id} sync failed:`, err.message);
        }
    }));
};

// GET /api/servers
exports.getUserServers = handle('List servers', async (req, res) => {
    const rows = await q('SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);
    await syncDeploying(rows);
    res.json({
        servers: rows.map(({ root_password, ...s }) => ({
            ...s,
            monthly_cost: parseFloat(s.monthly_cost),
            hourly_cost: parseFloat(s.hourly_cost),
        })),
    });
});

const ownServer = async (userId, id) => {
    if (!/^\d{1,10}$/.test(String(id))) throw new HttpError(404, 'Server not found');
    const [server] = await q('SELECT * FROM servers WHERE id = ? AND user_id = ?', [id, userId]);
    if (!server) throw new HttpError(404, 'Server not found');
    return server;
};

// POST /api/servers/manage { serverId, action }
exports.manageServer = handle('Manage server', async (req, res) => {
    const { serverId, action } = req.body;
    if (!['start', 'stop', 'restart'].includes(action)) throw new HttpError(400, 'Invalid action');
    const server = await ownServer(req.user.userId, serverId);
    if (server.status === 'deploying') throw new HttpError(409, 'The server is still being created.');

    if (action !== 'stop' && (await billing.isSuspended(req.user.userId))) {
        // Suspended for an unpaid invoice; paying it starts the servers again.
        throw new HttpError(402, 'Your services are suspended for an unpaid invoice. Pay it in Billing → Invoices to start your servers.', { suspended: true });
    }
    if (server.solus_server_id) await (await solusAccounts.clientForAccountId(server.solus_account_id)).serverAction(server.solus_server_id, action);

    const status = action === 'stop' ? 'stopped' : 'active';
    await q('UPDATE servers SET status = ?, last_activity = NOW() WHERE id = ?', [status, server.id]);
    res.json({ message: `Server ${action} requested`, status });
});

// DELETE /api/servers/:serverId — cancels the plan at the end of the month:
// the server keeps running until then, is billed to the month's end and is
// deleted on the 1st (utils/monthlyBilling.js). A server that never got
// created is removed straight away.
exports.deleteServer = handle('Cancel server', async (req, res) => {
    const server = await ownServer(req.user.userId, req.params.serverId);
    if (server.status === 'failed' || !server.solus_server_id) {
        await billing.discardUsage(server.id); // never ran: nothing to bill
        await billing.destroyServer(server);
        return res.json({ message: 'Server removed' });
    }
    if (server.cancel_at) return res.json({ message: 'This plan is already cancelled.', cancelAt: server.cancel_at });
    const at = await billing.scheduleCancel(server);
    res.json({ message: 'Plan cancelled. The server keeps running until the end of the month and is then deleted.', cancelAt: at });
});

// POST /api/servers/:serverId/keep — undo a cancellation before it takes effect.
exports.keepServer = handle('Keep server', async (req, res) => {
    const server = await ownServer(req.user.userId, req.params.serverId);
    if (!server.cancel_at) return res.json({ message: 'This plan is not cancelled.' });
    await billing.undoCancel(server);
    res.json({ message: 'Cancellation withdrawn. The server stays.' });
});
