/**
 * App Platform administration (utils/appPlans.js), Admin → Products → App
 * Platform: the plans (add, edit, hide, delete, like VM plans) and every
 * customer's apps. Public: GET /api/plans/apps for the Pricing page.
 */
const connection = require('../config/db');
const appPlans = require('../utils/appPlans');
const audit = require('../utils/audit');
const serverLocations = require('../utils/serverLocations');
const productLocations = require('../utils/productLocations');

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
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A plan with that name already exists.' });
        console.error(`Admin apps ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

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
    if (has('type') || !partial) {
        if (!appPlans.TYPES[body.type]) throw new HttpError(400, 'Type must be Shared or Dedicated.');
        out.type = body.type;
    }
    num('vcpu', 'vCPUs', { min: 0.1, max: 512 });
    num('ram', 'RAM (GB)', { min: 0.25, max: 4096 });
    num('storage', 'Storage (GB)', { min: 1, max: 100000, int: true });
    num('bandwidth', 'Bandwidth (GB)', { min: 0, max: 10000000, int: true });
    num('monthly', 'Monthly price (₹)', { min: 1, max: 10000000 });
    if (has('sortOrder')) num('sortOrder', 'Order', { min: -100000, max: 100000, int: true });
    if (body.dedicatedIp !== undefined) out.dedicatedIp = Boolean(body.dedicatedIp);
    if (body.active !== undefined) out.active = Boolean(body.active);
    return out;
};

const COLUMNS = {
    type: 'plan_type', vcpu: 'vcpu', ram: 'ram_gb', storage: 'storage_gb', bandwidth: 'bandwidth_gb',
    dedicatedIp: 'dedicated_ip', monthly: 'price_inr', sortOrder: 'sort_order', active: 'active',
};
const PLAN_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/;

module.exports = {
    // GET /api/plans/apps — public: on-sale plans, and the types (Dedicated: coming soon)
    publicPlans: handle(async (req, res) => {
        const plans = (await appPlans.getPlans()).map(({ id, active, sortOrder, ...p }) => p);
        res.json({
            plans,
            types: Object.entries(appPlans.TYPES).map(([id, t]) => ({ id, label: t.label, available: t.available })),
            fromPrice: plans.length ? Math.min(...plans.map((p) => p.monthly)) : null,
        });
    }),

    // GET /api/admin/apps/plans
    listPlans: handle(async (req, res) => {
        const [plans, used] = await Promise.all([
            appPlans.getPlans({ all: true }),
            q('SELECT plan_name, COUNT(*) AS n FROM app_platform_apps GROUP BY plan_name'),
        ]);
        const count = Object.fromEntries(used.map((r) => [r.plan_name, Number(r.n)]));
        res.json({
            types: Object.fromEntries(Object.entries(appPlans.TYPES).map(([id, t]) => [id, t.label])),
            plans: plans.map((p) => ({ ...p, apps: count[p.name] || 0 })),
        });
    }),

    createPlan: handle(async (req, res) => {
        const name = String(req.body.name || '').trim();
        if (!PLAN_NAME.test(name)) throw new HttpError(400, 'Plan name: 2 to 40 letters, numbers, dots, dashes or underscores (e.g. DPsAP_4).');
        const p = readPlan(req.body);
        const ins = await q(
            `INSERT INTO app_plans (name, plan_type, vcpu, ram_gb, storage_gb, bandwidth_gb, dedicated_ip, price_inr, active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, p.type, p.vcpu, p.ram, p.storage, p.bandwidth, p.dedicatedIp ?? false, p.monthly, p.active ?? true, p.sortOrder ?? 0],
        );
        appPlans.forgetPlans();
        audit(req, 'app_plans.create', 'app_plan', ins.insertId, { name, ...p });
        res.status(201).json({ id: ins.insertId, message: `${name} added.` });
    }),

    updatePlan: handle(async (req, res) => {
        const id = Number(req.params.id);
        const before = (await appPlans.getPlans({ all: true })).find((p) => p.id === id);
        if (!before) throw new HttpError(404, 'Plan not found.');
        if (req.body.name !== undefined && String(req.body.name).trim() !== before.name) {
            throw new HttpError(400, "A plan's name can't be changed. Hide this plan and add a new one instead.");
        }
        const p = readPlan(req.body, { partial: true });
        const keys = Object.keys(p);
        if (!keys.length) throw new HttpError(400, 'Nothing to change.');
        await q(`UPDATE app_plans SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`, [...keys.map((k) => p[k]), id]);
        appPlans.forgetPlans();
        audit(req, 'app_plans.update', 'app_plan', id, { name: before.name, changes: p });
        res.json({ message: `${before.name} saved.` });
    }),

    removePlan: handle(async (req, res) => {
        const id = Number(req.params.id);
        const plan = (await appPlans.getPlans({ all: true })).find((p) => p.id === id);
        if (!plan) throw new HttpError(404, 'Plan not found.');
        const [{ n }] = await q('SELECT COUNT(*) AS n FROM app_platform_apps WHERE plan_name = ?', [plan.name]);
        if (Number(n) > 0) throw new HttpError(409, `${plan.name} is used by ${n} app${Number(n) === 1 ? '' : 's'}, so it can't be deleted. Hide it instead.`);
        await q('DELETE FROM app_plans WHERE id = ?', [id]);
        appPlans.forgetPlans();
        audit(req, 'app_plans.delete', 'app_plan', id, { name: plan.name });
        res.json({ message: `${plan.name} deleted.` });
    }),

    // GET /api/admin/product-locations/:product — where Managed Database ('database') or App Platform ('apps') is offered
    getProductLocations: handle(async (req, res) => {
        if (!productLocations.PRODUCTS.includes(req.params.product)) throw new HttpError(404, 'Unknown product.');
        const [all, offered] = await Promise.all([serverLocations.getLocations({ all: true }), productLocations.getLocationIds(req.params.product)]);
        res.json({ locations: all.map((l) => ({ id: l.id, name: l.name, country: l.country, active: l.active, offered: offered.has(l.id) })) });
    }),

    // PUT /api/admin/product-locations/:product { locationIds: [..] }
    setProductLocations: handle(async (req, res) => {
        const product = req.params.product;
        if (!productLocations.PRODUCTS.includes(product)) throw new HttpError(404, 'Unknown product.');
        const known = new Set((await serverLocations.getLocations({ all: true })).map((l) => l.id));
        const ids = [...new Set((Array.isArray(req.body.locationIds) ? req.body.locationIds : []).map(Number))].filter((id) => known.has(id));
        const before = [...(await productLocations.getLocationIds(product))];
        await productLocations.setLocations(product, ids);
        audit(req, 'product.locations', 'settings', product, { before, after: ids });
        res.json({ message: ids.length ? 'Locations saved.' : 'Saved. With no locations, nothing can be ordered.' });
    }),

    // GET /api/admin/apps — every customer's apps
    listApps: handle(async (req, res) => {
        const rows = await q(
            `SELECT a.*, u.name AS customer, u.email, u.waladmin_id FROM app_platform_apps a JOIN users u ON u.id = a.user_id
              ORDER BY a.created_at DESC LIMIT 500`,
        );
        res.json({
            apps: rows.map((a) => ({
                id: a.id, userId: a.user_id, customer: a.customer, email: a.email, waladminId: a.waladmin_id,
                domain: a.domain, location: a.location || '', plan: a.plan_name, type: a.plan_type, monthlyCost: Number(a.monthly_cost),
                status: a.status, suspended: Boolean(a.suspended_at), paidUntil: a.paid_until, cancelAt: a.cancel_at, createdAt: a.created_at,
            })),
        });
    }),
};
