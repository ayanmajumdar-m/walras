const appSettings = require('./appSettings');
const computeStock = require('./computeStock');
const ccavenueSI = require('../services/ccavenueSI');
const taxService = require('../services/taxServices');

/**
 * Platform switches admins control from Settings, stored in app_settings.
 * Defaults reproduce how the platform behaved before these switches existed.
 */

// What invoices showed when these details were hard-coded.
const INVOICE_DEFAULTS = {
    legalName: 'Noutikal Technologies',
    registeredAddress: 'Kashimpur Shibalaya Road, Digha Sarada Pally, Nebadhai Duttapukur, North Twenty Four Parganas - 743248, West Bengal, India',
    gstAddress: 'Kashimpur Shibalaya Road, Digha Sarada Pally, Nebadhai Duttapukur, North Twenty Four Parganas - 743248, West Bengal',
    gstin: '19GDSPM2994C1ZV',
    sac: '998315', // SAC: hosting and IT infrastructure provisioning services (cloud servers)
    email: 'support@walras.net',
    phone: '',
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

/**
 * The seller details invoices show (Admin → Settings → Invoice details).
 * GST follows the GSTIN here: its state decides CGST + SGST or IGST.
 */
const invoiceDetailsFrom = (s) => {
    const invoice = { ...INVOICE_DEFAULTS, ...parseJson(s['invoice.details'], {}) };
    taxService.setSellerGstin(invoice.gstin);
    return invoice;
};
const getInvoiceDetails = async () => invoiceDetailsFrom(await appSettings.getAll());

const getPlatform = async () => {
    const s = await appSettings.getAll();
    return {
        maintenanceMode: s['platform.maintenance_mode'] === 'true',
        paymentsPaused: s['platform.payments_paused'] === 'true',
        // Account balance top-ups. Off until an admin turns them back on in
        // Settings (unset counts as paused, unlike the other switches).
        topUpsPaused: s['platform.topups_paused'] !== 'false',
        // Auto top-up (CCAvenue standing instructions). Off by default, and
        // can't run until the SI integration is confirmed (services/ccavenueSI.js).
        autoTopupEnabled: s['platform.auto_topup'] === 'true',
        autoTopupReady: ccavenueSI.SPEC_CONFIRMED,
        planAvailability: {
            // In stock in at least one location (stock and SolusVM in Admin → Virtual Machine stock).
            compute: Object.fromEntries(Object.entries(await computeStock.getAvailability())
                .map(([name, locations]) => [name, Object.keys(locations).length > 0])),
        },
        invoice: invoiceDetailsFrom(s),
    };
};

const setPlatform = ({ maintenanceMode, paymentsPaused, topUpsPaused, autoTopupEnabled }) =>
    appSettings.setMany({
        'platform.maintenance_mode': String(Boolean(maintenanceMode)),
        'platform.payments_paused': String(Boolean(paymentsPaused)),
        'platform.topups_paused': String(Boolean(topUpsPaused)),
        'platform.auto_topup': String(Boolean(autoTopupEnabled)),
    });

const setInvoiceDetails = async (details) => {
    const clean = {};
    for (const key of Object.keys(INVOICE_DEFAULTS)) {
        if (typeof details?.[key] === 'string') clean[key] = details[key].trim().slice(0, 300);
    }
    await appSettings.setMany({ 'invoice.details': JSON.stringify(clean) });
    return getInvoiceDetails();
};

/**
 * Express guard for buying a plan (servers, domains). Refused during
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
    INVOICE_DEFAULTS,
    getPlatform,
    getInvoiceDetails,
    setPlatform,
    setInvoiceDetails,
    requireSalesOpen,
};
