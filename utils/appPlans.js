/**
 * App Platform plans (table app_plans), managed in Admin → Products → App
 * Platform → Plans: name, type, specs and price. Types: Shared (on sale) and
 * Dedicated (coming soon: no Dedicated plan is sold until one is added and
 * the type is opened). A plan's name can't change once created: apps refer
 * to it by name. There's no provisioning integration yet: an app is active
 * as soon as it's paid (controllers/appPlatform.controllers.js).
 */
const connection = require('../config/db');

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

module.exports = { TYPES, getPlans, findPlan, forgetPlans };
