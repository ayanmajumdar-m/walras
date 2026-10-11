/**
 * Managed Database plans and stock (the Virtual Machine equivalent is
 * utils/computeStock.js).
 *
 * Plans live in db_plans (Admin → Products → Managed Database → Plans): name,
 * specs, backup retention and prices. All plans are General Purpose; the
 * engine (MySQL or PostgreSQL) is picked per database and doesn't change the
 * price. A plan's name can't change once created: stock and existing
 * databases refer to it by name.
 *
 * Stock is a quantity per plan per location (table db_stock, location_id =
 * server_locations.id), set in Admin → Managed Database → Stock. Ordering
 * takes one unit; deleting a database gives it back. A plan is on sale in a
 * location while the plan and the location are active and stock is above
 * zero. (No provisioning integration yet: admins set databases up.)
 */
const connection = require('../config/db');
const serverLocations = require('./serverLocations');

const ENGINES = { mysql: 'MySQL', postgresql: 'PostgreSQL' };

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

// ── Plans ──────────────────────────────────────────────────────────────────

const toPlan = (r) => ({
    id: r.id,
    name: r.name,
    vcpu: Number(r.vcpu),             // 0.5 = half a core
    ram: Number(r.ram_gb),            // GB; 0.5 = 512 MB
    storage: Number(r.storage_gb),    // GB; 0.5 = 500 MB
    backupDays: Number(r.backup_days), // daily backups kept this many days
    monthly: Number(r.price_inr),     // rupees per month, excluding GST
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
});

let cache = null;
const loadPlans = async () => {
    if (cache && cache.until > Date.now()) return cache.plans;
    const rows = await q('SELECT * FROM db_plans ORDER BY sort_order, price_inr, name');
    cache = { plans: rows.map(toPlan), until: Date.now() + 30 * 1000 };
    return cache.plans;
};
const forgetPlans = () => { cache = null; };

const getPlans = async ({ all = false } = {}) => {
    const plans = await loadPlans();
    return all ? plans : plans.filter((p) => p.active);
};

const findPlan = async (name, opts) => (await getPlans(opts)).find((p) => p.name === name) || null;

// ── Stock ──────────────────────────────────────────────────────────────────

const getStockRows = () => q('SELECT plan, location_id, quantity FROM db_stock');

/** { [plan]: { [locationId]: quantity } } for every plan, hidden ones included. */
const getStock = async () => {
    const out = Object.fromEntries((await getPlans({ all: true })).map((p) => [p.name, {}]));
    for (const r of await getStockRows()) {
        if (out[r.plan]) out[r.plan][r.location_id] = Number(r.quantity);
    }
    return out;
};

const setStock = async (entries) => {
    for (const { plan, locationId, quantity } of entries) {
        await q(
            `INSERT INTO db_stock (plan, location_id, quantity, updated_at) VALUES (?, ?, ?, NOW())
             ON CONFLICT (plan, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
             RETURNING plan`,
            [plan, locationId, quantity],
        );
    }
};

/** Takes one unit atomically. Resolves true if one was available. */
const reserve = async (plan, locationId) => {
    const res = await q(
        'UPDATE db_stock SET quantity = quantity - 1, updated_at = NOW() WHERE plan = ? AND location_id = ? AND quantity > 0 RETURNING quantity',
        [plan, locationId],
    );
    return (res.rows || []).length === 1;
};

/** Gives one unit back (a failed order, or a deleted database). */
const release = (plan, locationId) => q(
    `INSERT INTO db_stock (plan, location_id, quantity, updated_at) VALUES (?, ?, 1, NOW())
     ON CONFLICT (plan, location_id) DO UPDATE SET quantity = db_stock.quantity + 1, updated_at = NOW()
     RETURNING plan`,
    [plan, locationId],
);

/**
 * What customers may buy now: { [plan]: { [locationId]: true } } for active
 * plans and locations with stock. Never throws: on any error nothing is on sale.
 */
const getAvailability = async () => {
    try {
        const [plans, locations, rows] = await Promise.all([getPlans(), serverLocations.getLocations(), getStockRows()]);
        const out = Object.fromEntries(plans.map((p) => [p.name, {}]));
        const active = new Set(locations.map((l) => l.id));
        for (const r of rows) {
            const loc = Number(r.location_id);
            if (out[r.plan] && active.has(loc) && Number(r.quantity) > 0) out[r.plan][loc] = true;
        }
        return out;
    } catch (err) {
        console.error('Database availability failed:', err.message);
        return {};
    }
};

module.exports = { ENGINES, getPlans, findPlan, forgetPlans, getStock, setStock, reserve, release, getAvailability };
