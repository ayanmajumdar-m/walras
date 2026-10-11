/**
 * App Platform for customers (utils/appPlans.js): choose a location (where
 * App Platform is offered: utils/productLocations.js), a Shared plan and a
 * domain, pay, and the app is active. Billed like a monthly server
 * (utils/monthlyBilling.js): the rest of this month pro rata from the
 * balance, then on the 1st. No provisioning integration yet.
 */
const connection = require('../config/db');
const appPlans = require('../utils/appPlans');
const billing = require('../utils/monthlyBilling');
const platformSettings = require('../utils/platformSettings');
const productLocations = require('../utils/productLocations');

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
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That domain is already on an App Platform app.' });
        console.error(`${label} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// A domain name: labels of letters, digits and hyphens, with a dot (example.com, app.example.co.in).
const DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const cleanDomain = (raw) => String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');

const publicApp = (a) => ({
    id: a.id,
    domain: a.domain,
    plan: a.plan_name,
    type: a.plan_type,
    location: a.location || '',
    monthlyCost: Number(a.monthly_cost),
    status: a.status,
    suspended: Boolean(a.suspended_at),
    paidUntil: a.paid_until,
    cancelAt: a.cancel_at,
    createdAt: a.created_at,
    note: a.admin_note || '',
});

const ownApp = async (userId, id) => {
    if (!/^\d{1,10}$/.test(String(id))) throw new HttpError(404, 'App not found.');
    const [a] = await q('SELECT * FROM app_platform_apps WHERE id = ? AND user_id = ?', [id, userId]);
    if (!a) throw new HttpError(404, 'App not found.');
    return a;
};

// GET /api/apps/catalog — types and plans
exports.getCatalog = handle('App Platform catalogue', async (req, res) => {
    const [all, places] = await Promise.all([appPlans.getPlans(), productLocations.getLocations('apps')]);
    const plans = all.map(({ id, active, sortOrder, ...p }) => p);
    res.json({
        locations: places.map((l) => ({ id: l.id, name: l.name, country: l.country, flagUrl: l.flagUrl })),
        types: Object.entries(appPlans.TYPES).map(([id, t]) => ({ id, label: t.label, available: t.available })),
        plans,
        enabled: plans.length > 0 && places.length > 0,
    });
});

// POST /api/apps { plan, location, domain } — paid now and active straight away
exports.createApp = handle('Create app', async (req, res) => {
    const userId = req.user.userId;
    const plan = typeof req.body.plan === 'string' ? await appPlans.findPlan(req.body.plan) : null;
    const domain = cleanDomain(req.body.domain);
    if (!plan) throw new HttpError(400, 'Choose a plan.');
    const location = /^\d{1,10}$/.test(String(req.body.location ?? '')) ? await productLocations.findLocation('apps', req.body.location) : null;
    if (!location) throw new HttpError(400, 'Choose a location.');
    if (!DOMAIN.test(domain)) throw new HttpError(400, 'Enter a valid domain, e.g. example.com or app.example.com.');
    const [taken] = await q('SELECT user_id FROM app_platform_apps WHERE LOWER(domain) = ?', [domain]);
    if (taken) {
        throw new HttpError(409, Number(taken.user_id) === Number(userId)
            ? `You already have an app on ${domain}.` : 'That domain is already on an App Platform app.');
    }
    if (await billing.hasOverdue(userId)) {
        throw new HttpError(402, 'You have an overdue invoice. Pay it in Billing → Invoices to deploy new apps.', { overdue: true });
    }

    const [user] = await q('SELECT id, address, gstin FROM users WHERE id = ?', [userId]);
    await platformSettings.getInvoiceDetails(); // GST follows the seller GSTIN in Settings
    const now = new Date();
    const quote = billing.quotePurchase(user, plan.monthly, now, 1);
    quote.notes = quote.notes.replace(/^New server, /, 'New app, ');

    if (!(await billing.chargeBalance(userId, quote.total))) {
        const [wallet] = await q('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
        throw new HttpError(402, `Your account balance is too low. This app costs ₹${(quote.total / 100).toFixed(2)} now (${quote.days} days of this month, incl. GST). Add funds and try again.`, {
            insufficient: true, required: quote.total / 100, available: Number(wallet?.balance || 0) / 100,
        });
    }
    let app;
    try {
        [app] = (await q(
            `INSERT INTO app_platform_apps (user_id, domain, plan_name, plan_type, location_id, location, monthly_cost, paid_until)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [userId, domain, plan.name, plan.type, location.id, location.name, plan.monthly, quote.paidUntil],
        )).rows;
    } catch (err) {
        await billing.refundBalance(userId, quote.total).catch((e) => console.error('App refund failed:', e.message));
        throw err;
    }
    await billing.recordPurchase({ userId, label: billing.appLabel(app), ref: `A${app.id}`, quote, now })
        .catch((e) => console.error(`Purchase invoice for app ${app.id} failed:`, e.message));

    res.status(201).json({ message: `Your app on ${domain} is active.`, app: publicApp(app), charged: quote.total / 100 });
});

// GET /api/apps
exports.listApps = handle('List apps', async (req, res) => {
    const rows = await q('SELECT * FROM app_platform_apps WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);
    res.json({ apps: rows.map(publicApp) });
});

// DELETE /api/apps/:id — cancels at the end of the paid month; then it's deleted.
exports.cancelApp = handle('Cancel app', async (req, res) => {
    const a = await ownApp(req.user.userId, req.params.id);
    if (a.cancel_at) return res.json({ message: 'This app is already cancelled.', cancelAt: a.cancel_at });
    const now = new Date();
    const paidUntil = a.paid_until ? new Date(a.paid_until) : null;
    const at = paidUntil && paidUntil > now ? paidUntil : billing.nextMonthStart(now);
    await q('UPDATE app_platform_apps SET cancel_at = ? WHERE id = ?', [at, a.id]);
    const lastDay = new Date(at.getTime() - 1).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
    res.json({ message: `Cancelled. The app keeps running until ${lastDay} and is then deleted.`, cancelAt: at });
});

// POST /api/apps/:id/keep — undo a cancellation before it takes effect.
exports.keepApp = handle('Keep app', async (req, res) => {
    const a = await ownApp(req.user.userId, req.params.id);
    if (!a.cancel_at) return res.json({ message: 'This app is not cancelled.' });
    await q('UPDATE app_platform_apps SET cancel_at = NULL WHERE id = ?', [a.id]);
    res.json({ message: 'Cancellation withdrawn. The app stays.' });
});
