/**
 * Managed Database administration (utils/databaseStock.js), Admin → Products
 * → Managed Database:
 *   Plans     add, edit, hide, delete (like VM plans)
 *   Stock     how many of each plan may be sold per location
 *   Databases customers' databases. There's no provisioning integration yet,
 *             so an admin sets each new one up and marks it ready with its
 *             connection details (the password is stored encrypted), or
 *             removes it and refunds the purchase.
 * Public: GET /api/plans/database lists the active plans for the Pricing page.
 */
const connection = require('../config/db');
const dbStock = require('../utils/databaseStock');
const serverLocations = require('../utils/serverLocations');
const productLocations = require('../utils/productLocations');
const billing = require('../utils/monthlyBilling');
const audit = require('../utils/audit');
const integrations = require('../utils/integrations');
const { encryptSecret } = require('../utils/secrets');
const { sendRawEmail, escapeHtml } = require('../utils/sendEmail');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const rowsOf = (r) => (Array.isArray(r) ? r : r?.rows || []);

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
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A plan with that name already exists.' });
        console.error(`Admin databases ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const idOf = (raw, what = 'Database') => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, `${what} not found.`);
    return id;
};

// ── Plans ──────────────────────────────────────────────────────────────────

const readPlan = (body, { partial = false } = {}) => {
    const out = {};
    const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== '';
    const num = (k, label, { min, max, int = false }) => {
        if (!has(k)) {
            if (!partial) throw new HttpError(400, `${label} is required.`);
            return;
        }
        const v = Number(body[k]);
        if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) {
            throw new HttpError(400, `${label} must be ${int ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
        }
        out[k] = v;
    };
    num('vcpu', 'vCPUs', { min: 0.1, max: 512 });
    num('ram', 'RAM (GB)', { min: 0.25, max: 4096 });
    num('storage', 'Storage (GB)', { min: 0.1, max: 100000 });
    num('backupDays', 'Backup retention (days)', { min: 0, max: 365, int: true });
    num('monthly', 'Monthly price (₹)', { min: 1, max: 10000000 });
    if (has('sortOrder')) num('sortOrder', 'Order', { min: -100000, max: 100000, int: true });
    if (body.active !== undefined) out.active = Boolean(body.active);
    return out;
};

const COLUMNS = {
    vcpu: 'vcpu', ram: 'ram_gb', storage: 'storage_gb', backupDays: 'backup_days', monthly: 'price_inr',
    sortOrder: 'sort_order', active: 'active',
};
const PLAN_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/;

// ── Databases ──────────────────────────────────────────────────────────────

const siteUrl = () => (integrations.get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '');

const emailReady = async (db) => {
    try {
        const [u] = await q('SELECT name, email FROM users WHERE id = ?', [db.user_id]);
        if (!u?.email) return;
        const url = `${siteUrl()}/dashboard/resources?tab=databases`;
        const lines = [
            `Your ${dbStock.ENGINES[db.engine]} database ${db.name} is ready.`,
            `Host: ${db.host}  ·  Port: ${db.port}  ·  Database: ${db.db_name}  ·  User: ${db.db_user}`,
            'The password is in the console under Resources → Databases.',
        ];
        await sendRawEmail({
            to: u.email,
            subject: `Your database ${db.name} is ready`,
            text: [`Hi ${u.name || 'there'},`, '', ...lines, '', url, '', 'Walras Cloud'].join('\n'),
            html: `<p>Hi ${escapeHtml(u.name || 'there')},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}<p><a href="${escapeHtml(url)}">Open Databases</a></p><p>Walras Cloud</p>`,
        });
    } catch (err) {
        console.error(`Database ready email for ${db.id} failed:`, err.message);
    }
};

const HOST = /^(?=.{1,255}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$|^[0-9a-fA-F:]{2,39}$/;
const IDENT = /^[A-Za-z0-9_$.-]{1,64}$/;

module.exports = {
    // GET /api/plans/database — public
    publicPlans: handle(async (req, res) => {
        const plans = (await dbStock.getPlans()).map(({ id, active, sortOrder, ...p }) => p);
        res.json({
            plans,
            engines: Object.entries(dbStock.ENGINES).map(([id, label]) => ({ id, label })),
            fromPrice: plans.length ? Math.min(...plans.map((p) => p.monthly)) : null,
        });
    }),

    // GET /api/admin/db/plans
    listPlans: handle(async (req, res) => {
        const [plans, used] = await Promise.all([
            dbStock.getPlans({ all: true }),
            q('SELECT plan_name, COUNT(*) AS n FROM managed_databases GROUP BY plan_name'),
        ]);
        const count = Object.fromEntries(used.map((r) => [r.plan_name, Number(r.n)]));
        res.json({ plans: plans.map((p) => ({ ...p, databases: count[p.name] || 0 })) });
    }),

    // POST /api/admin/db/plans
    createPlan: handle(async (req, res) => {
        const name = String(req.body.name || '').trim();
        if (!PLAN_NAME.test(name)) throw new HttpError(400, 'Plan name: 2 to 40 letters, numbers, dots, dashes or underscores (e.g. MDsIN_xlarge).');
        const p = readPlan(req.body);
        const ins = await q(
            `INSERT INTO db_plans (name, vcpu, ram_gb, storage_gb, backup_days, price_inr, active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, p.vcpu, p.ram, p.storage, p.backupDays, p.monthly, p.active ?? true, p.sortOrder ?? 0],
        );
        dbStock.forgetPlans();
        audit(req, 'db_plans.create', 'db_plan', ins.insertId, { name, ...p });
        res.status(201).json({ id: ins.insertId, message: `${name} added.` });
    }),

    // PUT /api/admin/db/plans/:id — everything but the name
    updatePlan: handle(async (req, res) => {
        const id = idOf(req.params.id, 'Plan');
        const before = (await dbStock.getPlans({ all: true })).find((p) => p.id === id);
        if (!before) throw new HttpError(404, 'Plan not found.');
        if (req.body.name !== undefined && String(req.body.name).trim() !== before.name) {
            throw new HttpError(400, "A plan's name can't be changed. Hide this plan and add a new one instead.");
        }
        const p = readPlan(req.body, { partial: true });
        const keys = Object.keys(p);
        if (!keys.length) throw new HttpError(400, 'Nothing to change.');
        await q(`UPDATE db_plans SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`, [...keys.map((k) => p[k]), id]);
        dbStock.forgetPlans();
        audit(req, 'db_plans.update', 'db_plan', id, { name: before.name, changes: p });
        res.json({ message: `${before.name} saved.` });
    }),

    // DELETE /api/admin/db/plans/:id — only plans no database has used
    removePlan: handle(async (req, res) => {
        const id = idOf(req.params.id, 'Plan');
        const plan = (await dbStock.getPlans({ all: true })).find((p) => p.id === id);
        if (!plan) throw new HttpError(404, 'Plan not found.');
        const [{ n }] = await q('SELECT COUNT(*) AS n FROM managed_databases WHERE plan_name = ?', [plan.name]);
        if (Number(n) > 0) throw new HttpError(409, `${plan.name} is used by ${n} database${Number(n) === 1 ? '' : 's'}, so it can't be deleted. Hide it instead.`);
        await q('DELETE FROM db_stock WHERE plan = ?', [plan.name]);
        await q('DELETE FROM db_plans WHERE id = ?', [id]);
        dbStock.forgetPlans();
        audit(req, 'db_plans.delete', 'db_plan', id, { name: plan.name });
        res.json({ message: `${plan.name} deleted.` });
    }),

    // GET /api/admin/db/stock
    getStock: handle(async (req, res) => {
        const [plans, stock, locations, offered, running] = await Promise.all([
            dbStock.getPlans({ all: true }), dbStock.getStock(), serverLocations.getLocations({ all: true }), productLocations.getLocationIds('database'),
            q('SELECT plan_name, location_id, COUNT(*) AS n FROM managed_databases GROUP BY plan_name, location_id'),
        ]);
        const inUse = {};
        for (const r of running) (inUse[r.plan_name] ||= {})[r.location_id] = Number(r.n);
        res.json({
            // Stock is edited for the locations Managed Database is offered in; the rest can be switched on.
            locations: locations.filter((l) => offered.has(l.id)).map((l) => ({ id: l.id, name: l.active ? l.name : `${l.name} (hidden)` })),
            allLocations: locations.map((l) => ({ id: l.id, name: l.name, active: l.active, offered: offered.has(l.id) })),
            plans: plans.map((p) => ({ ...p, stock: stock[p.name] || {}, inUse: inUse[p.name] || {} })),
        });
    }),

    // PUT /api/admin/db/stock { plans: [{ name, stock: { [locationId]: quantity } }] }
    updateStock: handle(async (req, res) => {
        const list = Array.isArray(req.body.plans) ? req.body.plans : [];
        const known = new Set((await dbStock.getPlans({ all: true })).map((p) => p.name));
        const locations = new Set((await serverLocations.getLocations({ all: true })).map((l) => l.id));
        const entries = [];
        for (const p of list) {
            if (!known.has(p?.name)) continue;
            for (const [loc, qty] of Object.entries(p.stock || {})) {
                const locationId = Number(loc);
                const quantity = Number(qty);
                if (!locations.has(locationId)) continue;
                if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
                    throw new HttpError(400, `Stock for ${p.name} must be a whole number from 0 to 100000.`);
                }
                entries.push({ plan: p.name, locationId, quantity });
            }
        }
        const before = await dbStock.getStock();
        await dbStock.setStock(entries);
        audit(req, 'db.stock', 'settings', 'database', { before, after: await dbStock.getStock() });
        res.json({ message: 'Managed Database stock saved' });
    }),

    // GET /api/admin/db/databases?status=provisioning|active|all
    listDatabases: handle(async (req, res) => {
        const status = ['provisioning', 'active', 'failed'].includes(req.query.status) ? req.query.status : null;
        const rows = await q(
            `SELECT d.*, u.name AS customer, u.email, u.waladmin_id FROM managed_databases d JOIN users u ON u.id = d.user_id
              ${status ? 'WHERE d.status = ?' : ''}
              ORDER BY CASE WHEN d.status = 'provisioning' THEN 0 ELSE 1 END, d.created_at DESC LIMIT 500`,
            status ? [status] : [],
        );
        const [counts] = await q(
            "SELECT COUNT(*) FILTER (WHERE status = 'provisioning')::int AS provisioning, COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*)::int AS total FROM managed_databases",
        );
        res.json({
            counts,
            databases: rows.map((d) => ({
                id: d.id, userId: d.user_id, customer: d.customer, email: d.email, waladminId: d.waladmin_id,
                name: d.name, engine: d.engine, engineLabel: dbStock.ENGINES[d.engine], plan: d.plan_name, location: d.location,
                monthlyCost: Number(d.monthly_cost), status: d.status, suspended: Boolean(d.suspended_at),
                paidUntil: d.paid_until, cancelAt: d.cancel_at, createdAt: d.created_at, readyAt: d.ready_at,
                host: d.host || '', port: d.port || '', database: d.db_name || '', user: d.db_user || '',
                hasPassword: Boolean(d.password_encrypted), note: d.admin_note || '',
            })),
        });
    }),

    /**
     * PUT /api/admin/db/databases/:id/ready { host, port, database, user, password?, note? }
     * Marks a database set up (or updates its details). The customer is emailed the first time.
     */
    markReady: handle(async (req, res) => {
        const id = idOf(req.params.id);
        const [cur] = await q('SELECT * FROM managed_databases WHERE id = ?', [id]);
        if (!cur) throw new HttpError(404, 'Database not found.');
        const host = String(req.body.host || '').trim();
        const port = Number(req.body.port);
        const database = String(req.body.database || '').trim();
        const user = String(req.body.user || '').trim();
        const password = req.body.password === undefined || req.body.password === null ? '' : String(req.body.password);
        const note = req.body.note === undefined ? cur.admin_note : String(req.body.note || '').trim().slice(0, 500) || null;
        if (!HOST.test(host)) throw new HttpError(400, 'Enter the host name or IP address.');
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new HttpError(400, 'Port must be from 1 to 65535.');
        if (!IDENT.test(database)) throw new HttpError(400, 'Database name: up to 64 letters, numbers, _ $ . or -.');
        if (!IDENT.test(user)) throw new HttpError(400, 'User: up to 64 letters, numbers, _ $ . or -.');
        if (password && (password.length < 8 || password.length > 128)) throw new HttpError(400, 'Password must be 8 to 128 characters.');
        if (!password && !cur.password_encrypted) throw new HttpError(400, 'Enter the database password.');
        const [row] = rowsOf(await q(
            `UPDATE managed_databases SET status = 'active', host = ?, port = ?, db_name = ?, db_user = ?,
                    password_encrypted = COALESCE(?, password_encrypted), admin_note = ?, ready_at = COALESCE(ready_at, NOW())
              WHERE id = ? RETURNING *`,
            [host, port, database, user, password ? encryptSecret(password) : null, note, id],
        ));
        audit(req, 'db.ready', 'managed_database', id, { name: cur.name, host, port, database, user, passwordChanged: Boolean(password) });
        if (cur.status !== 'active') await emailReady(row);
        res.json({ message: cur.status === 'active' ? `${cur.name}: details saved.` : `${cur.name} is ready. The customer has been emailed.` });
    }),

    /**
     * POST /api/admin/db/databases/:id/refund — a database that couldn't be set
     * up: removed, its stock returned and the purchase refunded to the balance.
     */
    refund: handle(async (req, res) => {
        const id = idOf(req.params.id);
        const [db] = await q('SELECT * FROM managed_databases WHERE id = ?', [id]);
        if (!db) throw new HttpError(404, 'Database not found.');
        if (db.ready_at) throw new HttpError(409, "This database was set up, so it can't be refunded here. The customer can cancel it.");
        const [inv] = await q(
            "SELECT id, invoice_number, total_amount FROM monthly_invoices WHERE user_id = ? AND kind = 'purchase' AND invoice_number LIKE ? ORDER BY id DESC LIMIT 1",
            [db.user_id, `%-D${db.id}`],
        );
        const amount = Number(inv?.total_amount || 0);
        await billing.withUserLock(db.user_id, async () => {
            if (amount > 0) {
                await billing.refundBalance(db.user_id, amount);
                await q(
                    `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
                     SELECT id, 'credit', ?, ?, ?, 'completed' FROM wallets WHERE user_id = ?`,
                    [amount, `Refund: Managed Database ${db.name} couldn't be set up (invoice ${inv.invoice_number})`, `db_refund_${db.id}`, db.user_id],
                );
            }
            await billing.destroyDatabase(db);
        });
        audit(req, 'db.refund', 'managed_database', id, { name: db.name, userId: db.user_id, amount });
        res.json({ message: amount ? `${db.name} removed and ₹${(amount / 100).toFixed(2)} refunded to the customer's balance.` : `${db.name} removed.` });
    }),
};
