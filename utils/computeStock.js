/**
 * Virtual Machine catalogue and stock.
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

// Virtual Machine → General Purpose. Same plans and prices as
// client/src/data/plans.js (rupees, excluding GST; usd for reference).
// ram and bandwidth in GB (ram 0.5 = 512 MB). network in Gbps.
const CPU_TYPES = { intel: 'Intel', amd: 'AMD' };
const vm = (name, cpu, vcpu, ram, storage, bandwidth, monthly, usd) =>
    ({ name, cpu, vcpu, ram, storage, bandwidth, network: 1, monthly, usd });
const COMPUTE_PLANS = [
    vm('VMgIN_0.5', 'intel', 1, 0.5, 10, 256, 350, 3.5),
    vm('VMgIN_1', 'intel', 1, 1, 20, 512, 450, 4.5),
    vm('VMgIN_2', 'intel', 1, 2, 40, 1024, 980, 10),
    vm('VMgIN_4', 'intel', 2, 4, 60, 2048, 1400, 15),
    vm('VMgIN_8', 'intel', 4, 8, 80, 4096, 2400, 25),
    vm('VMgIN_16', 'intel', 6, 16, 120, 5120, 4000, 40),
    vm('VMgIN_24', 'intel', 8, 24, 160, 8192, 6000, 65),
    vm('VMgIN_32', 'intel', 10, 32, 200, 10240, 9000, 95),
    vm('VMgIN_64', 'intel', 14, 64, 400, 20480, 12000, 125),
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
    CPU_TYPES,
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
