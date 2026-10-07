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
const taxService = require('../services/taxServices');
const serverLocations = require('../utils/serverLocations');

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

const ensureWallet = async (userId) => {
    const [wallet] = await q('SELECT * FROM wallets WHERE user_id = ?', [userId]);
    if (wallet) return wallet;
    await q('INSERT INTO wallets (user_id, balance) VALUES (?, 0)', [userId]);
    return (await q('SELECT * FROM wallets WHERE user_id = ?', [userId]))[0];
};

// RFC 1123 hostname: labels of letters, digits and hyphens (100 characters max, the column size).
const HOSTNAME = /^(?=.{1,100}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

const validPassword = (p) =>
    typeof p === 'string' && p.length >= 10 && p.length <= 72 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && !/\s/.test(p);

// ── Catalogue ──────────────────────────────────────────────────────────────

// GET /api/servers/catalog — plans with prices, where each is in stock, and the OS choices.
exports.getCatalog = handle('Compute catalogue', async (req, res) => {
    const [availability, active, places] = await Promise.all([stock.getAvailability(), stock.getPlans(), serverLocations.getLocations()]);
    // Locations from Admin → Locations. id is the SolusVM location (what stock
    // and deploy use); null = not linked yet, shown as "coming soon".
    const locations = places.map((l) => ({ id: l.solusLocationId, name: l.name, country: l.country }));
    const sellable = new Set(locations.filter((l) => l.id).map((l) => l.id));
    const plans = active.map(({ id, active: _a, sortOrder: _s, ...p }) => ({
        ...p,
        hourly: stock.hourlyRupees(p),
        locations: Object.keys(availability[p.name] || {}).map(Number).filter((id) => sellable.has(id)),
    }));
    let os = [];
    if (solusvm.solusConfigured()) {
        try {
            os = await solusvm.listOsVersions();
        } catch (err) {
            console.error('Compute catalogue (SolusVM) failed:', err.message);
            return res.json({ enabled: false, plans: plans.map((p) => ({ ...p, locations: [] })), locations, os: [] });
        }
    }
    res.json({ enabled: plans.some((p) => p.locations.length > 0), plans, locations, os });
});

// ── Deploy ─────────────────────────────────────────────────────────────────

// POST /api/servers/deploy { plan, location, os, hostname, password }
exports.deployServer = handle('Deploy server', async (req, res) => {
    const userId = req.user.userId;
    const planName = typeof req.body.plan === 'string' ? req.body.plan : req.body.plan?.name;
    const locationId = Number(req.body.location);
    const osId = Number(req.body.os);
    const hostname = String(req.body.hostname || '').trim().toLowerCase();
    const password = req.body.password;

    // Active plans only: a hidden plan can't be bought, whatever the browser sends.
    const plan = typeof planName === 'string' ? await stock.findPlan(planName) : null;
    if (!plan) throw new HttpError(400, 'Choose a plan.');
    if (!Number.isInteger(locationId)) throw new HttpError(400, 'Choose a location.');
    if (!Number.isInteger(osId)) throw new HttpError(400, 'Choose an operating system.');
    if (!HOSTNAME.test(hostname)) throw new HttpError(400, 'Enter a valid hostname, e.g. web1 or app.example.com.');
    if (!validPassword(password)) {
        throw new HttpError(400, 'Use a root password of 10 to 72 characters with upper and lower case letters and a number, and no spaces.');
    }

    const outOfStock = () => new HttpError(409, `${plan.name} is out of stock in that location.`, { outOfStock: true });
    if (!solusvm.solusConfigured()) throw outOfStock();
    const solusPlanId = (await stock.getPlanMap())[plan.name];
    if (!solusPlanId) throw outOfStock();

    // Only active locations linked to SolusVM in Admin → Locations.
    const [location, osVersions] = await Promise.all([serverLocations.findBySolusId(locationId), solusvm.listOsVersions()]);
    if (!location) throw new HttpError(400, 'Choose a location.');
    if (!osVersions.some((o) => o.id === osId)) throw new HttpError(400, 'Choose an operating system.');

    // First hour, charged now; the hourly billing job charges the rest.
    const hourly = stock.hourlyRupees(plan);
    const [user] = await q('SELECT id, address FROM users WHERE id = ?', [userId]);
    const firstHour = taxService.calculateTax(user || {}, Math.round(hourly * 100)).totalAmount;
    const wallet = await ensureWallet(userId);

    // 1. Take a unit of stock.
    if (!(await stock.reserve(plan.name, locationId))) throw outOfStock();

    // 2. Charge the first hour, only if the balance covers it.
    const debit = await q('UPDATE wallets SET balance = balance - ? WHERE id = ? AND balance >= ?', [firstHour, wallet.id, firstHour]);
    if (!debit.affectedRows) {
        await stock.release(plan.name, locationId);
        throw new HttpError(400, 'Your account balance is too low for this server.', {
            insufficient: true, required: firstHour / 100, available: Number(wallet.balance) / 100,
        });
    }

    const undo = async (serverId) => {
        await q('UPDATE wallets SET balance = balance + ? WHERE id = ?', [firstHour, wallet.id]).catch((e) => console.error('Deploy refund failed:', e.message));
        await stock.release(plan.name, locationId).catch((e) => console.error('Deploy stock return failed:', e.message));
        if (serverId) await q('DELETE FROM servers WHERE id = ?', [serverId]).catch(() => {});
    };

    // 3. Our record of the server.
    let serverId;
    try {
        const ins = await q(
            `INSERT INTO servers (user_id, name, hostname, location, location_id, os, plan_name, monthly_cost, hourly_cost, currency, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'deploying')`,
            [userId, hostname, hostname, location.name, locationId, ((osVersions.find((o) => o.id === osId) || {}).name || String(osId)).slice(0, 50), plan.name, plan.monthly, hourly],
        );
        serverId = ins.insertId;
    } catch (err) {
        await undo(null);
        throw err;
    }

    // 4. The VM itself.
    let vm;
    try {
        vm = await solusvm.createServer({ name: hostname, planId: solusPlanId, locationId, osVersionId: osId, password });
    } catch (err) {
        await undo(serverId);
        if (err instanceof solusvm.SolusError && err.status === 422) {
            throw new HttpError(400, `SolusVM refused the server: ${err.message}`);
        }
        console.error('SolusVM create failed:', err.message);
        throw new HttpError(502, "We couldn't create your server right now. You haven't been charged; please try again shortly.");
    }

    await q('UPDATE servers SET solus_server_id = ?, status = ?, ip_address = ? WHERE id = ?',
        [vm.id, solusvm.walrasStatus(vm), solusvm.primaryIp(vm), serverId]);
    await q(
        `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, razorpay_payment_id, razorpay_order_id, status)
         VALUES (?, 'debit', ?, ?, ?, NULL, NULL, 'completed')`,
        [wallet.id, firstHour, `Virtual Machine first hour - ${hostname} (${plan.name})`, `server_${serverId}`],
    ).catch((e) => console.error('Deploy transaction record failed:', e.message));
    await q(
        `INSERT INTO billing_logs (user_id, server_id, amount, billing_period, description) VALUES (?, ?, ?, NOW(), ?)`,
        [userId, serverId, firstHour, `Hourly charge for ${hostname} - ${plan.name}`],
    ).catch((e) => console.error('Deploy billing log failed:', e.message));

    res.status(201).json({ message: 'Server is being created', serverId, charge: firstHour / 100 });
});

// ── List / manage / delete ─────────────────────────────────────────────────

// Refresh servers still being built from SolusVM (status and IP address).
const syncDeploying = async (servers) => {
    const pending = servers.filter((s) => s.solus_server_id && s.status === 'deploying');
    await Promise.all(pending.map(async (s) => {
        try {
            const vm = await solusvm.getServer(s.solus_server_id);
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
    if (solusvm.solusConfigured()) await syncDeploying(rows);
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

    if (action === 'start' && server.solus_server_id) {
        // Billing stops servers when the balance runs out; don't restart them for free.
        const [wallet] = await q('SELECT balance FROM wallets WHERE user_id = ?', [req.user.userId]);
        if (Number(wallet?.balance || 0) < Math.round(Number(server.hourly_cost) * 100)) {
            throw new HttpError(400, 'Your account balance is too low to start this server.', { insufficient: true });
        }
    }
    if (server.solus_server_id) await solusvm.serverAction(server.solus_server_id, action);

    const status = action === 'stop' ? 'stopped' : 'active';
    await q('UPDATE servers SET status = ?, last_activity = NOW() WHERE id = ?', [status, server.id]);
    res.json({ message: `Server ${action} requested`, status });
});

// DELETE /api/servers/:serverId — destroys the VM and returns its unit of stock.
exports.deleteServer = handle('Delete server', async (req, res) => {
    const server = await ownServer(req.user.userId, req.params.serverId);
    if (server.solus_server_id) await solusvm.deleteServer(server.solus_server_id);
    await q('DELETE FROM servers WHERE id = ?', [server.id]);
    if (server.solus_server_id && server.location_id && (await stock.findPlan(server.plan_name, { all: true }))) {
        await stock.release(server.plan_name, server.location_id).catch((e) => console.error('Stock return failed:', e.message));
    }
    res.json({ message: 'Server deleted' });
});
