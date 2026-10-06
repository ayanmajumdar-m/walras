const appSettings = require('./appSettings');
const computeStock = require('./computeStock');

/**
 * Platform switches admins control from Settings, stored in app_settings.
 * Defaults reproduce how the platform behaved before these switches existed.
 */

// A family listed here can't be sold. Cloud Compute is not listed: it is on
// sale wherever its stock allows (utils/computeStock.js).
// Web Hosting is withdrawn for now: no new hosting can be bought. Existing
// hosting accounts keep running and stay manageable. Delete the entry to
// sell it again (the per-plan switches in Settings then apply).
const LOCKED_FAMILIES = {
    hosting: 'Web Hosting is withdrawn for now, so no new hosting can be bought. Existing hosting accounts keep running.',
};

const PLAN_DEFAULTS = {
    hosting: { Seed: true, Tree: true },
    compute: { 'WSC-4GB': false, 'SFC-8GB': false, 'SFC-16GB': false, 'SFC-32GB': false },
};

// What invoices showed when these details were hard-coded.
const INVOICE_DEFAULTS = {
    legalName: 'IOOGN TECHNOLOGIES (OPC) PRIVATE LIMITED',
    registeredAddress: 'IOOGNS HQ, Khudiram Sarani, Duttapukur, North 24 Parganas - 743248, Barasat - I, West Bengal, India',
    gstAddress: '1, IOOGN HQ, Duttapukur Station Road, Aurobindapally, Nebadhai Duttapukur, North 24 Parganas - 743248, West Bengal',
    gstin: '19AAHCI9209H1Z9',
    email: 'support@walras.net',
    phone: '+91 94296 94951',
    bankName: '',
    accountNumber: '',
    ifsc: '',
};

const parseJson = (raw, fallback) => {
    try {
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
};

const getPlatform = async () => {
    const s = await appSettings.getAll();
    const plans = parseJson(s['plans.availability'], {});
    return {
        maintenanceMode: s['platform.maintenance_mode'] === 'true',
        paymentsPaused: s['platform.payments_paused'] === 'true',
        // Account balance top-ups. Off until an admin turns them back on in
        // Settings (unset counts as paused, unlike the other switches).
        topUpsPaused: s['platform.topups_paused'] !== 'false',
        planAvailability: {
            hosting: LOCKED_FAMILIES.hosting
                ? Object.fromEntries(Object.keys(PLAN_DEFAULTS.hosting).map((name) => [name, false]))
                : { ...PLAN_DEFAULTS.hosting, ...(plans.hosting || {}) },
            // In stock in at least one location (stock and SolusVM in Settings → Compute stock).
            compute: Object.fromEntries(Object.entries(await computeStock.getAvailability())
                .map(([name, locations]) => [name, Object.keys(locations).length > 0])),
        },
        lockedFamilies: LOCKED_FAMILIES,
        invoice: { ...INVOICE_DEFAULTS, ...parseJson(s['invoice.details'], {}) },
    };
};

const setPlatform = ({ maintenanceMode, paymentsPaused, topUpsPaused }) =>
    appSettings.setMany({
        'platform.maintenance_mode': String(Boolean(maintenanceMode)),
        'platform.payments_paused': String(Boolean(paymentsPaused)),
        'platform.topups_paused': String(Boolean(topUpsPaused)),
    });

const setPlanAvailability = (availability) => {
    const clean = { hosting: {} };
    for (const family of ['hosting'].filter((f) => !LOCKED_FAMILIES[f])) {
        for (const plan of Object.keys(PLAN_DEFAULTS[family])) {
            if (availability?.[family] && plan in availability[family]) clean[family][plan] = Boolean(availability[family][plan]);
        }
    }
    return appSettings.setMany({ 'plans.availability': JSON.stringify(clean) });
};

const setInvoiceDetails = (details) => {
    const clean = {};
    for (const key of Object.keys(INVOICE_DEFAULTS)) {
        if (typeof details?.[key] === 'string') clean[key] = details[key].trim().slice(0, 300);
    }
    return appSettings.setMany({ 'invoice.details': JSON.stringify(clean) });
};

/**
 * Express guard for buying a plan (hosting, servers, domains). Refused during
 * maintenance or while "All plans out of stock" is on. Account balance
 * top-ups use requireTopUpsOpen instead: they aren't a plan.
 */
const requireSalesOpen = async (req, res, next) => {
    try {
        const { maintenanceMode, paymentsPaused } = await getPlatform();
        if (maintenanceMode) {
            return res.status(503).json({ error: 'Walras Cloud is under maintenance. Please try again shortly.', maintenance: true });
        }
        // "paymentsPaused" is the stored name; admins see it as "All plans out of stock".
        if (paymentsPaused) {
            return res.status(409).json({ error: 'This plan is out of stock right now.', outOfStock: true });
        }
        next();
    } catch (err) {
        console.error('Platform settings check failed:', err.message);
        next(); // a settings read failure must not take checkout down with it
    }
};

/**
 * Express guard for customer sign-in and sign-up: refused during maintenance.
 * Admin sign-in does not use this, so the panel stays reachable.
 */
const requireNotMaintenance = async (req, res, next) => {
    try {
        const { maintenanceMode } = await getPlatform();
        if (maintenanceMode) {
            return res.status(503).json({ error: 'Walras Cloud is under maintenance. Sign-in and sign-up will be back shortly.', maintenance: true });
        }
    } catch (err) {
        console.error('Platform settings check failed:', err.message);
    }
    next();
};

/**
 * Express guard for starting an account balance top-up: refused during
 * maintenance or while top-ups are paused in Settings. Payment callbacks for
 * top-ups already started are not guarded, so those still complete.
 */
const requireTopUpsOpen = async (req, res, next) => {
    try {
        const { maintenanceMode, topUpsPaused } = await getPlatform();
        if (maintenanceMode) {
            return res.status(503).json({ error: 'Walras Cloud is under maintenance. Please try again shortly.', maintenance: true });
        }
        if (topUpsPaused) {
            return res.status(409).json({ error: 'Adding funds to your account balance is unavailable right now.', topUpsPaused: true });
        }
    } catch (err) {
        console.error('Platform settings check failed:', err.message);
    }
    next();
};

module.exports = {
    requireNotMaintenance,
    requireTopUpsOpen,
    LOCKED_FAMILIES,
    PLAN_DEFAULTS,
    INVOICE_DEFAULTS,
    getPlatform,
    setPlatform,
    setPlanAvailability,
    setInvoiceDetails,
    requireSalesOpen,
};
