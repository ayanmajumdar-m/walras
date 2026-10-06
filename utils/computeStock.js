/**
 * Cloud Compute catalogue and stock.
 *
 * Plans and prices live here, on the server: the price a customer pays never
 * comes from the browser. Stock is a quantity per plan per SolusVM location
 * (table compute_stock), set by admins. Deploying takes one unit; deleting a
 * server gives it back. A plan is on sale in a location only while SolusVM is
 * configured, the plan is linked to a SolusVM plan, and stock is above zero.
 */
const connection = require('../config/db');
const appSettings = require('./appSettings');
const solusvm = require('../services/solusvm');

// Same plans and prices as client/src/data/plans.js (prices exclude GST).
const COMPUTE_PLANS = [
    { name: 'WSC-4GB', vcpu: 2, ram: 4, storage: 60, bandwidth: 2, monthly: 900 },
    { name: 'SFC-8GB', vcpu: 4, ram: 8, storage: 120, bandwidth: 4, monthly: 1800 },
    { name: 'SFC-16GB', vcpu: 6, ram: 16, storage: 240, bandwidth: 6, monthly: 3600 },
    { name: 'SFC-32GB', vcpu: 10, ram: 32, storage: 480, bandwidth: 10, monthly: 5400 },
];
const HOURS_PER_MONTH = 720;

const findPlan = (name) => COMPUTE_PLANS.find((p) => p.name === name) || null;
// Hourly price in rupees, rounded to the paisa.
const hourlyRupees = (plan) => Math.round((plan.monthly * 100) / HOURS_PER_MONTH) / 100;

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const PLAN_MAP_KEY = 'compute.plan_map';

/** { 'WSC-4GB': <SolusVM plan id>, … } */
const getPlanMap = async () => {
    try {
        const raw = (await appSettings.getAll())[PLAN_MAP_KEY];
        const map = raw ? JSON.parse(raw) : {};
        return Object.fromEntries(Object.entries(map).filter(([name, id]) => findPlan(name) && Number.isInteger(id) && id > 0));
    } catch {
        return {};
    }
};

const setPlanMap = (map) => {
    const clean = {};
    for (const p of COMPUTE_PLANS) {
        const id = Number(map?.[p.name]);
        if (Number.isInteger(id) && id > 0) clean[p.name] = id;
    }
    return appSettings.setMany({ [PLAN_MAP_KEY]: JSON.stringify(clean) });
};

/** [{ plan, location_id, quantity }] */
const getStockRows = () => q('SELECT plan, location_id, quantity FROM compute_stock');

/** { [plan]: { [locationId]: quantity } } */
const getStock = async () => {
    const out = Object.fromEntries(COMPUTE_PLANS.map((p) => [p.name, {}]));
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
 * What customers may buy right now: { [plan]: { [locationId]: true } }.
 * Never throws: on any error nothing is on sale.
 */
const getAvailability = async () => {
    const out = Object.fromEntries(COMPUTE_PLANS.map((p) => [p.name, {}]));
    if (!solusvm.solusConfigured()) return out;
    try {
        const [map, rows] = await Promise.all([getPlanMap(), getStockRows()]);
        for (const r of rows) {
            if (out[r.plan] && map[r.plan] && Number(r.quantity) > 0) out[r.plan][r.location_id] = true;
        }
    } catch (err) {
        console.error('Compute availability failed:', err.message);
    }
    return out;
};

module.exports = {
    COMPUTE_PLANS,
    findPlan,
    hourlyRupees,
    getPlanMap,
    setPlanMap,
    getStock,
    setStock,
    reserve,
    release,
    getAvailability,
};
