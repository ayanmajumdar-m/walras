/**
 * Managed Databases for customers (utils/databaseStock.js): General Purpose
 * plans, a location and an engine (MySQL or PostgreSQL), sold against the
 * stock admins set per plan and location, and billed like a monthly server
 * (utils/monthlyBilling.js): the rest of this month pro rata from the
 * balance, then on the 1st. There's no provisioning integration yet: a new
 * database waits as "provisioning" until an admin sets it up and enters its
 * connection details, which the customer then sees here.
 */
const connection = require('../config/db');
const dbStock = require('../utils/databaseStock');
const serverLocations = require('../utils/serverLocations');
const billing = require('../utils/monthlyBilling');
const platformSettings = require('../utils/platformSettings');
const { decryptSecret } = require('../utils/secrets');

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
        console.error(`${label} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// 3–40 characters: lowercase letters, digits and hyphens, starting with a letter.
const DB_NAME = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

const publicDatabase = (d) => ({
    id: d.id,
    name: d.name,
    engine: d.engine,
    engineLabel: dbStock.ENGINES[d.engine] || d.engine,
    plan: d.plan_name,
    location: d.location,
    monthlyCost: Number(d.monthly_cost),
    status: d.status,
    suspended: Boolean(d.suspended_at),
    paidUntil: d.paid_until,
    cancelAt: d.cancel_at,
    createdAt: d.created_at,
    readyAt: d.ready_at,
    // Connection details, once an admin has set the database up. The password is fetched separately.
    connection: d.status === 'active' && d.host ? {
        host: d.host, port: d.port, database: d.db_name, user: d.db_user, hasPassword: Boolean(d.password_encrypted),
    } : null,
    note: d.admin_note || '',
});

const ownDatabase = async (userId, id) => {
    if (!/^\d{1,10}$/.test(String(id))) throw new HttpError(404, 'Database not found.');
    const [d] = await q('SELECT * FROM managed_databases WHERE id = ? AND user_id = ?', [id, userId]);
    if (!d) throw new HttpError(404, 'Database not found.');
    return d;
};

// GET /api/databases/catalog — plans, engines, locations and where each plan is in stock
exports.getCatalog = handle('Database catalogue', async (req, res) => {
    const [availability, plans, places] = await Promise.all([dbStock.getAvailability(), dbStock.getPlans(), serverLocations.getLocations()]);
    const list = plans.map(({ id, active, sortOrder, ...p }) => ({ ...p, locations: Object.keys(availability[p.name] || {}).map(Number) }));
    res.json({
        enabled: list.some((p) => p.locations.length > 0),
        engines: Object.entries(dbStock.ENGINES).map(([id, label]) => ({ id, label })),
        plans: list,
        locations: places.map((l) => ({ id: l.id, name: l.name, country: l.country, flagUrl: l.flagUrl })),
    });
});

// POST /api/databases { plan, location, engine, name }
exports.createDatabase = handle('Create database', async (req, res) => {
    const userId = req.user.userId;
    const plan = typeof req.body.plan === 'string' ? await dbStock.findPlan(req.body.plan) : null;
    const locationId = Number(req.body.location);
    const engine = String(req.body.engine || '');
    const name = String(req.body.name || '').trim().toLowerCase();
    if (!plan) throw new HttpError(400, 'Choose a plan.');
    if (!dbStock.ENGINES[engine]) throw new HttpError(400, 'Choose MySQL or PostgreSQL.');
    if (!DB_NAME.test(name)) throw new HttpError(400, 'Name: 3 to 40 lowercase letters, numbers or hyphens, starting with a letter (e.g. app-db).');
    const location = Number.isInteger(locationId) ? await serverLocations.findLocation(locationId) : null;
    if (!location) throw new HttpError(400, 'Choose a location.');
    const [dupe] = await q('SELECT id FROM managed_databases WHERE user_id = ? AND name = ?', [userId, name]);
    if (dupe) throw new HttpError(409, `You already have a database called ${name}.`);
    if (await billing.hasOverdue(userId)) {
        throw new HttpError(402, 'You have an overdue invoice. Pay it in Billing → Invoices to create new databases.', { overdue: true });
    }

    const [user] = await q('SELECT id, address, gstin FROM users WHERE id = ?', [userId]);
    await platformSettings.getInvoiceDetails(); // GST follows the seller GSTIN in Settings
    const now = new Date();
    const quote = billing.quotePurchase(user, plan.monthly, now, 1);
    quote.notes = quote.notes.replace(/^New server, /, 'New database, ');

    // 1. A unit of stock. 2. The pro rata price from the balance.
    if (!(await dbStock.reserve(plan.name, location.id))) {
        throw new HttpError(409, `${plan.name} is out of stock in ${location.name}.`, { outOfStock: true });
    }
    if (!(await billing.chargeBalance(userId, quote.total))) {
        await dbStock.release(plan.name, location.id);
        const [wallet] = await q('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
        throw new HttpError(402, `Your account balance is too low. This database costs ₹${(quote.total / 100).toFixed(2)} now (${quote.days} days of this month, incl. GST). Add funds and try again.`, {
            insufficient: true, required: quote.total / 100, available: Number(wallet?.balance || 0) / 100,
        });
    }

    // 3. Our record, paid until the 1st; an admin sets it up.
    let db;
    try {
        [db] = (await q(
            `INSERT INTO managed_databases (user_id, name, engine, plan_name, location_id, location, monthly_cost, paid_until)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [userId, name, engine, plan.name, location.id, location.name, plan.monthly, quote.paidUntil],
        )).rows;
    } catch (err) {
        await billing.refundBalance(userId, quote.total).catch((e) => console.error('Database refund failed:', e.message));
        await dbStock.release(plan.name, location.id).catch(() => {});
        throw err;
    }
    // 4. The paid invoice for the pro rata period.
    await billing.recordPurchase({ userId, label: billing.databaseLabel(db), ref: `D${db.id}`, quote, now })
        .catch((e) => console.error(`Purchase invoice for database ${db.id} failed:`, e.message));

    res.status(201).json({ message: "Database ordered. We're setting it up.", database: publicDatabase(db), charged: quote.total / 100 });
});

// GET /api/databases
exports.listDatabases = handle('List databases', async (req, res) => {
    const rows = await q('SELECT * FROM managed_databases WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);
    res.json({ databases: rows.map(publicDatabase) });
});

// GET /api/databases/:id/password — the database password, once it's set up
exports.getPassword = handle('Database password', async (req, res) => {
    const d = await ownDatabase(req.user.userId, req.params.id);
    if (d.status !== 'active' || !d.password_encrypted) throw new HttpError(404, "This database's password isn't available yet.");
    if (d.suspended_at) throw new HttpError(402, 'This database is suspended for an unpaid invoice. Pay it in Billing → Invoices.', { suspended: true });
    res.set('Cache-Control', 'no-store');
    res.json({ password: decryptSecret(d.password_encrypted) });
});

// DELETE /api/databases/:id — cancels at the end of the paid month; then it's deleted.
exports.cancelDatabase = handle('Cancel database', async (req, res) => {
    const d = await ownDatabase(req.user.userId, req.params.id);
    if (d.status === 'failed') {
        await billing.destroyDatabase(d);
        return res.json({ message: 'Database removed.' });
    }
    if (d.cancel_at) return res.json({ message: 'This database is already cancelled.', cancelAt: d.cancel_at });
    const now = new Date();
    const paidUntil = d.paid_until ? new Date(d.paid_until) : null;
    const at = paidUntil && paidUntil > now ? paidUntil : billing.nextMonthStart(now);
    await q('UPDATE managed_databases SET cancel_at = ? WHERE id = ?', [at, d.id]);
    const lastDay = new Date(at.getTime() - 1).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
    res.json({ message: `Cancelled. The database keeps running until ${lastDay} and is then deleted with its data.`, cancelAt: at });
});

// POST /api/databases/:id/keep — undo a cancellation before it takes effect.
exports.keepDatabase = handle('Keep database', async (req, res) => {
    const d = await ownDatabase(req.user.userId, req.params.id);
    if (!d.cancel_at) return res.json({ message: 'This database is not cancelled.' });
    await q('UPDATE managed_databases SET cancel_at = NULL WHERE id = ?', [d.id]);
    res.json({ message: 'Cancellation withdrawn. The database stays.' });
});

exports.publicDatabase = publicDatabase;
