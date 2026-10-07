/**
 * Virtual Machine plans (utils/computeStock.js, table vm_plans).
 *
 * Public: GET /api/plans/vm lists the active plans for the Pricing page.
 * Admin (Admin → VM plans): list every plan, add, edit, hide, delete.
 * A plan's name is fixed once created; a plan that any server has used
 * can't be deleted, only hidden.
 */
const connection = require('../config/db');
const computeStock = require('../utils/computeStock');
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
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A plan with that name already exists.' });
        console.error(`VM plans ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const publicPlan = ({ id, active, sortOrder, ...p }) => ({ ...p, hourly: computeStock.hourlyRupees(p) });

/** Checks and converts the editable fields. `partial` allows missing fields (edit). */
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
    if (has('cpu') || !partial) {
        if (!computeStock.CPU_TYPES[body.cpu]) throw new HttpError(400, 'CPU type must be Intel or AMD.');
        out.cpu = body.cpu;
    }
    num('vcpu', 'vCPUs', { min: 1, max: 512, int: true });
    num('ram', 'RAM (GB)', { min: 0.25, max: 4096 });
    num('storage', 'Storage (GB)', { min: 1, max: 100000, int: true });
    num('bandwidth', 'Bandwidth (GB)', { min: 0, max: 10000000, int: true });
    num('network', 'Network (Gbps)', { min: 0.1, max: 400 });
    num('monthly', 'Monthly price (₹)', { min: 1, max: 10000000 });
    // Optional: the $ price (cleared with null or "") and the display order.
    if (body.usd === null || body.usd === '') out.usd = null;
    else if (body.usd !== undefined) num('usd', 'Monthly price ($)', { min: 0, max: 100000 });
    if (has('sortOrder')) num('sortOrder', 'Order', { min: -100000, max: 100000, int: true });
    if (body.active !== undefined) out.active = Boolean(body.active);
    return out;
};

const COLUMNS = {
    cpu: 'cpu', vcpu: 'vcpu', ram: 'ram_gb', storage: 'storage_gb', bandwidth: 'bandwidth_gb',
    network: 'network_gbps', monthly: 'price_inr', usd: 'price_usd', sortOrder: 'sort_order', active: 'active',
};

const PLAN_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/;

const VmPlansController = {
    // GET /api/plans/vm — public
    publicList: handle(async (req, res) => {
        const plans = (await computeStock.getPlans()).map(publicPlan);
        res.json({ plans, fromPrice: plans.length ? Math.min(...plans.map((p) => p.monthly)) : null });
    }),

    // GET /api/admin/vm-plans
    list: handle(async (req, res) => {
        const [plans, used] = await Promise.all([
            computeStock.getPlans({ all: true }),
            q('SELECT plan_name, COUNT(*) AS n FROM servers GROUP BY plan_name'),
        ]);
        const servers = Object.fromEntries(used.map((r) => [r.plan_name, Number(r.n)]));
        res.json({
            cpuTypes: computeStock.CPU_TYPES,
            plans: plans.map((p) => ({ ...p, hourly: computeStock.hourlyRupees(p), servers: servers[p.name] || 0 })),
        });
    }),

    // POST /api/admin/vm-plans
    create: handle(async (req, res) => {
        const name = String(req.body.name || '').trim();
        if (!PLAN_NAME.test(name)) {
            throw new HttpError(400, 'Plan name: 2 to 40 letters, numbers, dots, dashes or underscores (e.g. VMgAM_4).');
        }
        const p = readPlan(req.body);
        const ins = await q(
            `INSERT INTO vm_plans (name, cpu, vcpu, ram_gb, storage_gb, bandwidth_gb, network_gbps, price_inr, price_usd, active, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, p.cpu, p.vcpu, p.ram, p.storage, p.bandwidth, p.network, p.monthly, p.usd ?? null, p.active ?? true, p.sortOrder ?? 0],
        );
        computeStock.forgetPlans();
        audit(req, 'plans.create', 'vm_plan', ins.insertId, { name, ...p });
        res.status(201).json({ id: ins.insertId, message: `${name} added.` });
    }),

    // PUT /api/admin/vm-plans/:id — everything but the name
    update: handle(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Plan not found.');
        const before = (await computeStock.getPlans({ all: true })).find((p) => p.id === id);
        if (!before) throw new HttpError(404, 'Plan not found.');
        if (req.body.name !== undefined && String(req.body.name).trim() !== before.name) {
            throw new HttpError(400, "A plan's name can't be changed. Hide this plan and add a new one instead.");
        }
        const p = readPlan(req.body, { partial: true });
        const keys = Object.keys(p);
        if (!keys.length) throw new HttpError(400, 'Nothing to change.');
        await q(
            `UPDATE vm_plans SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
            [...keys.map((k) => p[k]), id],
        );
        computeStock.forgetPlans();
        const changes = Object.fromEntries(keys.filter((k) => before[k] !== p[k]).map((k) => [k, { from: before[k], to: p[k] }]));
        audit(req, 'plans.update', 'vm_plan', id, { name: before.name, changes });
        res.json({ message: `${before.name} saved.` });
    }),

    // DELETE /api/admin/vm-plans/:id — only plans no server has ever used
    remove: handle(async (req, res) => {
        const id = Number(req.params.id);
        const plan = (await computeStock.getPlans({ all: true })).find((p) => p.id === id);
        if (!plan) throw new HttpError(404, 'Plan not found.');
        const [{ n }] = await q('SELECT COUNT(*) AS n FROM servers WHERE plan_name = ?', [plan.name]);
        if (Number(n) > 0) {
            throw new HttpError(409, `${plan.name} has been used by ${n} server${Number(n) === 1 ? '' : 's'}, so it can't be deleted. Hide it instead.`);
        }
        await q('DELETE FROM compute_stock WHERE plan = ?', [plan.name]);
        await q('DELETE FROM vm_plans WHERE id = ?', [id]);
        computeStock.forgetPlans();
        audit(req, 'plans.delete', 'vm_plan', id, { name: plan.name });
        res.json({ message: `${plan.name} deleted.` });
    }),
};

module.exports = VmPlansController;
