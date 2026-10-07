/**
 * Virtual Machine plans and stock.
 *
 * Plans live in the vm_plans table and are managed in Admin → VM plans: name,
 * CPU type, specs and prices. The price a customer pays always comes from
 * here, never from the browser. A plan's name can't change once created:
 * stock, the SolusVM link and existing servers all refer to it by name.
 * Hidden plans (active = false) aren't shown or sold; servers already on them
 * keep running at the price they were bought at (stored on the server).
 *
 * Stock is a quantity per plan per Walras location (table compute_stock,
 * location_id = server_locations.id), set in Admin → VM stock. Deploying
 * takes one unit; deleting a server gives it back. A plan is on sale in a
 * location only while the plan and location are active, stock is above zero,
 * and some active SolusVM account serves that location, has the plan linked
 * and is under its server limit (utils/solusAccounts.js).
 */
const connection = require('../config/db');
const solusAccounts = require('./solusAccounts');
const serverLocations = require('./serverLocations');

const CPU_TYPES = { intel: 'Intel', amd: 'AMD' };
const HOURS_PER_MONTH = 720;

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

// ── Plans ──────────────────────────────────────────────────────────────────

const toPlan = (r) => ({
    id: r.id,
    name: r.name,
    cpu: r.cpu,
    vcpu: Number(r.vcpu),
    ram: Number(r.ram_gb),           // GB; 0.5 = 512 MB
    storage: Number(r.storage_gb),   // GB NVMe SSD
    bandwidth: Number(r.bandwidth_gb), // GB per month; 1024 = 1 TB
    network: Number(r.network_gbps),
    monthly: Number(r.price_inr),    // rupees per month, excluding GST
    usd: r.price_usd === null ? null : Number(r.price_usd),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
});

// Plans change rarely; cache briefly. Admin edits call forgetPlans().
let cache = null;
const loadPlans = async () => {
    if (cache && cache.until > Date.now()) return cache.plans;
    const rows = await q('SELECT * FROM vm_plans ORDER BY cpu, sort_order, price_inr, name');
    cache = { plans: rows.map(toPlan), until: Date.now() + 30 * 1000 };
    return cache.plans;
};
const forgetPlans = () => { cache = null; };

/** Plans customers can see and buy, or every plan with { all: true }. */
const getPlans = async ({ all = false } = {}) => {
    const plans = await loadPlans();
    return all ? plans : plans.filter((p) => p.active);
};

/** A plan by name: active only, unless { all: true }. */
const findPlan = async (name, opts) => (await getPlans(opts)).find((p) => p.name === name) || null;

// Hourly price in rupees, rounded to the paisa (billing charges by the hour).
const hourlyRupees = (plan) => Math.round((plan.monthly * 100) / HOURS_PER_MONTH) / 100;

// ── Stock ──────────────────────────────────────────────────────────────────

/** [{ plan, location_id, quantity }] */
const getStockRows = () => q('SELECT plan, location_id, quantity FROM compute_stock');

/** { [plan]: { [locationId]: quantity } } for every plan, hidden ones included. */
const getStock = async () => {
    const out = Object.fromEntries((await getPlans({ all: true })).map((p) => [p.name, {}]));
    for (const r of await getStockRows()) {
        if (out[r.plan]) out[r.plan][r.location_id] = Number(r.quantity);
    }
    return out;
};

/** Replaces quantities: entries [{ plan, locationId, quantity }]. */
const setStock = async (entries) => {
    for (const { plan, locationId, quantity } of entries) {
        await q(
            `INSERT INTO compute_stock (plan, location_id, quantity, updated_at) VALUES (?, ?, ?, NOW())
             ON CONFLICT (plan, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
             RETURNING plan`,
            [plan, locationId, quantity],
        );
    }
};

/** Takes one unit atomically. Resolves true if one was available. */
const reserve = async (plan, locationId) => {
    const res = await q(
        `UPDATE compute_stock SET quantity = quantity - 1, updated_at = NOW()
         WHERE plan = ? AND location_id = ? AND quantity > 0 RETURNING quantity`,
        [plan, locationId],
    );
    return (res.rows || []).length === 1;
};

/** Gives one unit back (failed deploy, or a deleted server). */
const release = (plan, locationId) => q(
    `INSERT INTO compute_stock (plan, location_id, quantity, updated_at) VALUES (?, ?, 1, NOW())
     ON CONFLICT (plan, location_id) DO UPDATE SET quantity = compute_stock.quantity + 1, updated_at = NOW()
     RETURNING plan`,
    [plan, locationId],
);

/**
 * What customers may buy right now: { [plan]: { [locationId]: true } }, for
 * active plans and locations. Never throws: on any error nothing is on sale.
 */
const getAvailability = async () => {
    let plans = [];
    let locations = [];
    try {
        [plans, locations] = await Promise.all([getPlans(), serverLocations.getLocations()]);
    } catch (err) {
        console.error('VM plans or locations unavailable:', err.message);
        return {};
    }
    const out = Object.fromEntries(plans.map((p) => [p.name, {}]));
    try {
        const active = new Set(locations.map((l) => l.id));
        const [capacity, rows] = await Promise.all([solusAccounts.capacityMap(), getStockRows()]);
        for (const r of rows) {
            const loc = Number(r.location_id);
            if (out[r.plan] && active.has(loc) && Number(r.quantity) > 0 && capacity[r.plan]?.has(loc)) out[r.plan][loc] = true;
        }
    } catch (err) {
        console.error('Compute availability failed:', err.message);
    }
    return out;
};

module.exports = {
    CPU_TYPES,
    HOURS_PER_MONTH,
    getPlans,
    findPlan,
    forgetPlans,
    hourlyRupees,
    getStock,
    setStock,
    reserve,
    release,
    getAvailability,
};
