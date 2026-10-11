/**
 * App Platform plans (table app_plans), managed in Admin → Products → App
 * Platform → Plans: name, type, specs and price. Types: Shared (on sale) and
 * Dedicated (coming soon: no Dedicated plan is sold until one is added and
 * the type is opened). A plan's name can't change once created: apps refer
 * to it by name. There's no provisioning integration yet: an app is active
 * as soon as it's paid (controllers/appPlatform.controllers.js).
 *
 * Stock, like Managed Database: a quantity per plan per location (table
 * app_stock, Admin → App Platform → Stock). Deploying takes one; deleting an
 * app gives it back. A plan is on sale in a location while the plan is active,
 * the location is one App Platform is offered in (utils/productLocations.js)
 * and stock is above zero.
 */
const connection = require('../config/db');
const productLocations = require('./productLocations');

const TYPES = {
    shared: { label: 'Shared', available: true },
    dedicated: { label: 'Dedicated', available: false }, // coming soon
};

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const toPlan = (r) => ({
    id: r.id,
    name: r.name,
    type: r.plan_type,
    vcpu: Number(r.vcpu),
    ram: Number(r.ram_gb),              // GB
    storage: Number(r.storage_gb),      // GB NVMe SSD
    bandwidth: Number(r.bandwidth_gb),  // GB per month; 1024 = 1 TB
    dedicatedIp: Boolean(r.dedicated_ip),
    monthly: Number(r.price_inr),       // rupees per month, excluding GST
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
});

let cache = null;
const loadPlans = async () => {
    if (cache && cache.until > Date.now()) return cache.plans;
    const rows = await q('SELECT * FROM app_plans ORDER BY plan_type DESC, sort_order, price_inr, name');
    cache = { plans: rows.map(toPlan), until: Date.now() + 30 * 1000 };
    return cache.plans;
};
const forgetPlans = () => { cache = null; };

/** Active plans of a type that's on sale, or every plan with { all: true }. */
const getPlans = async ({ all = false } = {}) => {
    const plans = await loadPlans();
    return all ? plans : plans.filter((p) => p.active && TYPES[p.type]?.available);
};

const findPlan = async (name, opts) => (await getPlans(opts)).find((p) => p.name === name) || null;

// ── Stock ──────────────────────────────────────────────────────────────────

const getStockRows = () => q('SELECT plan, location_id, quantity FROM app_stock');

/** { [plan]: { [locationId]: quantity } } for every plan, hidden ones included. */
const getStock = async () => {
    const out = Object.fromEntries((await getPlans({ all: true })).map((p) => [p.name, {}]));
    for (const r of await getStockRows()) if (out[r.plan]) out[r.plan][r.location_id] = Number(r.quantity);
    return out;
};

const setStock = async (entries) => {
    for (const { plan, locationId, quantity } of entries) {
        await q(
            `INSERT INTO app_stock (plan, location_id, quantity, updated_at) VALUES (?, ?, ?, NOW())
             ON CONFLICT (plan, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
             RETURNING plan`,
            [plan, locationId, quantity],
        );
    }
};

/** Takes one unit atomically. Resolves true if one was available. */
const reserve = async (plan, locationId) => {
    const res = await q(
        'UPDATE app_stock SET quantity = quantity - 1, updated_at = NOW() WHERE plan = ? AND location_id = ? AND quantity > 0 RETURNING quantity',
        [plan, locationId],
    );
    return (res.rows || []).length === 1;
};

/** Gives one unit back (a failed order, or a deleted app). */
const release = (plan, locationId) => q(
    `INSERT INTO app_stock (plan, location_id, quantity, updated_at) VALUES (?, ?, 1, NOW())
     ON CONFLICT (plan, location_id) DO UPDATE SET quantity = app_stock.quantity + 1, updated_at = NOW()
     RETURNING plan`,
    [plan, locationId],
);

/** What customers may buy now: { [plan]: { [locationId]: true } }. Never throws. */
const getAvailability = async () => {
    try {
        const [plans, locations, rows] = await Promise.all([getPlans(), productLocations.getLocations('apps'), getStockRows()]);
        const out = Object.fromEntries(plans.map((p) => [p.name, {}]));
        const offered = new Set(locations.map((l) => l.id));
        for (const r of rows) {
            const loc = Number(r.location_id);
            if (out[r.plan] && offered.has(loc) && Number(r.quantity) > 0) out[r.plan][loc] = true;
        }
        return out;
    } catch (err) {
        console.error('App Platform availability failed:', err.message);
        return {};
    }
};

module.exports = { TYPES, getPlans, findPlan, forgetPlans, getStock, setStock, reserve, release, getAvailability };
