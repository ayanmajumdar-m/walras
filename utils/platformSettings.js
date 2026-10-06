const appSettings = require('./appSettings');

/**
 * Platform switches admins control from Settings, stored in app_settings.
 * Defaults reproduce how the platform behaved before these switches existed.
 */

// Cloud Compute can't be switched on from the admin: deployServer only
// simulates a server (random IP, no real VM) while charging the wallet, so
// selling it would bill customers for machines that don't exist.
const LOCKED_FAMILIES = {
    compute: 'Cloud Compute deployments are simulated (no real VM is created), so it stays unavailable until real provisioning is connected.',
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
        planAvailability: {
            hosting: { ...PLAN_DEFAULTS.hosting, ...(plans.hosting || {}) },
            compute: { ...PLAN_DEFAULTS.compute }, // locked, see LOCKED_FAMILIES
        },
        lockedFamilies: LOCKED_FAMILIES,
        invoice: { ...INVOICE_DEFAULTS, ...parseJson(s['invoice.details'], {}) },
    };
};

const setPlatform = ({ maintenanceMode, paymentsPaused }) =>
    appSettings.setMany({
        'platform.maintenance_mode': String(Boolean(maintenanceMode)),
        'platform.payments_paused': String(Boolean(paymentsPaused)),
    });

const setPlanAvailability = (availability) => {
    const clean = { hosting: {} };
    for (const family of ['hosting']) {
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
 * Express guard for anything that takes money or provisions a paid service.
 * Admins switch it via maintenance mode or "pause all payments".
 */
const requireSalesOpen = async (req, res, next) => {
    try {
        const { maintenanceMode, paymentsPaused } = await getPlatform();
        if (maintenanceMode) {
            return res.status(503).json({ error: 'Walras Cloud is under maintenance. Please try again shortly.', maintenance: true });
        }
        if (paymentsPaused) {
            return res.status(503).json({ error: 'Payments are temporarily paused. Please try again later.', paymentsPaused: true });
        }
        next();
    } catch (err) {
        console.error('Platform settings check failed:', err.message);
        next(); // a settings read failure must not take checkout down with it
    }
};

module.exports = {
    LOCKED_FAMILIES,
    PLAN_DEFAULTS,
    INVOICE_DEFAULTS,
    getPlatform,
    setPlatform,
    setPlanAvailability,
    setInvoiceDetails,
    requireSalesOpen,
};
