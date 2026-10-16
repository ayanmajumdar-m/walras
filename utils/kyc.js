/**
 * KYC (know your customer). New customers send their documents from the
 * console (Account → KYC verification); that opens a support ticket with the
 * subject "KYC VERIFICATION", listing each document by name, with the files
 * attached. An admin checks them and marks the customer verified by hand
 * (Admin → Customers → the customer → KYC). Until then, the services an admin
 * has chosen in Settings → KYC can't be ordered.
 *
 * users.kyc_status: unverified (nothing sent) → pending (documents sent) →
 * verified, or rejected (sent again after fixing). Customers who already had
 * an account when KYC arrived were marked verified once (config/db.js).
 */
const connection = require('../config/db');
const appSettings = require('./appSettings');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const TICKET_SUBJECT = 'KYC VERIFICATION';
const STATUSES = ['unverified', 'pending', 'verified', 'rejected'];

// Services KYC can be required for (Admin → Settings → KYC).
const PRODUCTS = {
    compute: 'Virtual Machines',
    database: 'Managed Database',
    apps: 'App Platform',
    supportPlus: 'Support +',
};
const DEFAULT_REQUIRED = ['compute', 'database', 'apps'];
const SETTING = 'kyc.required_products';

/*
  The documents we accept, by the account type chosen at sign-up
  (users.account_type 'personal' → individual, 'business' → business). Each slot is one file; the customer says which of
  the listed documents it is, and that name goes on the ticket.
*/
const DOCUMENTS = {
    individual: {
        label: 'Personal',
        slots: [
            { id: 'identity', label: 'Identity proof', required: true, options: ['PAN Card', 'Aadhaar Card', 'Passport', 'Voter ID'] },
            { id: 'address', label: 'Address proof', required: true, options: ['Aadhaar Card', 'Passport', 'Voter ID', 'Driving Licence'] },
        ],
        contact: 'Mobile number and email address, verified by OTP.',
    },
    business: {
        label: 'Business',
        slots: [
            { id: 'business', label: 'Business proof', required: true, options: ['Certificate of Incorporation', 'LLP Registration Certificate', 'Udyam Registration Certificate'] },
            { id: 'pan', label: 'Business PAN', required: false, hint: "PAN card issued in the business's name, where applicable.", options: ['Business PAN Card'] },
            { id: 'address', label: 'Address proof', required: true, options: ['Electricity bill', 'Utility bill', 'Rent agreement', 'Property tax receipt'] },
            { id: 'gst', label: 'GST proof', required: false, hint: 'Only if the business is GST registered.', options: ['GST Registration Certificate'] },
            { id: 'representative', label: "Authorised representative's ID", required: true, options: ['PAN Card', 'Other government-issued ID'] },
            { id: 'authorisation', label: 'Authorisation proof', required: false, hint: 'Where applicable.', options: ['Board resolution', 'Authorisation letter'] },
        ],
    },
};

const getRequired = async () => {
    const raw = await appSettings.get(SETTING);
    if (raw === undefined || raw === null) return [...DEFAULT_REQUIRED];
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? Object.keys(PRODUCTS).filter((p) => list.includes(p)) : [...DEFAULT_REQUIRED];
    } catch {
        return [...DEFAULT_REQUIRED];
    }
};

const setRequired = async (list) => {
    const clean = Object.keys(PRODUCTS).filter((p) => Array.isArray(list) && list.includes(p));
    await appSettings.setMany({ [SETTING]: JSON.stringify(clean) });
    return clean;
};

const statusOf = async (userId) => {
    const [u] = await q(
        `SELECT kyc_status, kyc_submitted_at, kyc_ticket_id, kyc_reviewed_at, kyc_note, account_type
           FROM users WHERE id = ?`,
        [userId]
    );
    if (!u) return null;
    return {
        status: STATUSES.includes(u.kyc_status) ? u.kyc_status : 'unverified',
        submittedAt: u.kyc_submitted_at,
        ticketId: u.kyc_ticket_id ? String(u.kyc_ticket_id) : null,
        reviewedAt: u.kyc_reviewed_at,
        // The note is shown to the customer only when their KYC was rejected.
        note: u.kyc_status === 'rejected' ? u.kyc_note || null : null,
        accountType: u.account_type === 'business' ? 'business' : 'individual',
    };
};

const lockedMessage = (product) =>
    `Complete your KYC verification to order ${PRODUCTS[product]}. Send your documents from Account → KYC verification; we'll unlock it once they're checked.`;

/**
 * Express guard for ordering a product that may need KYC. req.user.userId is
 * the account being worked in (the owner, for a team member).
 */
const requireKyc = (product) => async (req, res, next) => {
    try {
        if (!(await getRequired()).includes(product)) return next();
        const s = await statusOf(req.user.userId);
        if (s?.status === 'verified') return next();
        const error = req.user.actorId
            ? `The account owner needs to complete KYC verification before ${PRODUCTS[product]} can be ordered in this account.`
            : lockedMessage(product);
        return res.status(403).json({ error, kycRequired: true, kycStatus: s?.status || 'unverified' });
    } catch (err) {
        // Unlike the sales switches, a failed check refuses: KYC is a compliance gate.
        console.error('KYC check failed:', err.message);
        return res.status(503).json({ error: 'Something went wrong. Please try again.' });
    }
};

module.exports = { TICKET_SUBJECT, STATUSES, PRODUCTS, DOCUMENTS, getRequired, setRequired, statusOf, requireKyc };
