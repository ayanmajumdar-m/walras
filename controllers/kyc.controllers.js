/**
 * The customer's side of KYC (utils/kyc.js): their status, the documents we
 * accept, and sending them, which opens a "KYC VERIFICATION" support ticket.
 */
const connection = require('../config/db');
const zendesk = require('../services/zendesk');
const kyc = require('../utils/kyc');
const { accountNote } = require('./support.controllers');
const { APP_PLATFORM_ON } = require('../utils/appPlans');

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class KycError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof KycError) return res.status(err.status).json({ error: err.message });
        if (err instanceof zendesk.ZendeskError) {
            console.error('KYC ticket (Zendesk) failed:', err.message);
            return res.status(503).json({ error: "We couldn't send your documents right now. Please try again shortly, or email support@walras.net." });
        }
        console.error('KYC failed:', err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

/** One file for a document slot, checked like a support attachment. */
const fileFor = (slot, doc) => {
    if (!doc) {
        if (slot.required) throw new KycError(400, `Add your ${slot.label.toLowerCase()}.`);
        return null;
    }
    const name = String(doc.document || '');
    if (!slot.options.includes(name)) throw new KycError(400, `Choose which document your ${slot.label.toLowerCase()} is.`);
    const fileName = String(doc.fileName || '').trim().slice(0, 200);
    if (!fileName) throw new KycError(400, 'Each file needs a name.');
    if (!ALLOWED_TYPES.includes(doc.mimeType)) throw new KycError(400, `${fileName}: upload a PDF, JPG, PNG or WebP file.`);
    const data = Buffer.from(String(doc.data || ''), 'base64');
    if (!data.length) throw new KycError(400, `${fileName} is empty.`);
    if (data.length > MAX_FILE_BYTES) throw new KycError(400, `${fileName} is larger than 5 MB.`);
    return { slot, document: name, file: { fileName, mimeType: doc.mimeType, data } };
};

const KycController = {
    // GET /api/kyc/status
    status: handle(async (req, res) => {
        const [mine, required] = await Promise.all([kyc.statusOf(req.user.userId), kyc.getRequired()]);
        if (!mine) throw new KycError(404, 'Account not found.');
        res.json({
            ...mine,
            // App Platform is hidden for now, so it isn't named as locked.
            required: required.filter((id) => id !== 'apps' || APP_PLATFORM_ON).map((id) => ({ id, label: kyc.PRODUCTS[id] })),
            documents: kyc.DOCUMENTS,
            ticketSubject: kyc.TICKET_SUBJECT,
            supportConfigured: zendesk.zendeskConfigured(),
        });
    }),

    // POST /api/kyc { documents: { slotId: { document, fileName, mimeType, data } }, note? }
    // Which documents follows the account type chosen at sign-up.
    submit: handle(async (req, res) => {
        const userId = req.user.userId;
        const mine = await kyc.statusOf(userId);
        if (!mine) throw new KycError(404, 'Account not found.');
        if (mine.status === 'verified') throw new KycError(409, 'Your KYC is already verified.');
        if (mine.status === 'pending') throw new KycError(409, "We're already checking your documents. To add or change one, reply on your KYC VERIFICATION ticket in Support.");
        if (!zendesk.zendeskConfigured()) throw new KycError(503, 'Document upload is unavailable right now. Please email your KYC documents to support@walras.net.');

        const type = mine.accountType;
        const given = req.body.documents && typeof req.body.documents === 'object' ? req.body.documents : {};
        const docs = kyc.DOCUMENTS[type].slots.map((slot) => fileFor(slot, given[slot.id])).filter(Boolean);
        const note = String(req.body.note || '').trim().slice(0, 1000);

        const [u] = await q('SELECT name, email, phone, company, isemailverified FROM users WHERE id = ?', [userId]);
        const body = [
            `KYC documents for ${type === 'business' ? 'a business' : 'an individual'} customer, sent from the Walras console.`,
            '',
            `Customer: ${u?.name || '-'}${type === 'business' && u?.company ? ` (${u.company})` : ''}`,
            `Email: ${u?.email || '-'}${u?.isemailverified ? ' (verified by OTP)' : ' (not verified)'}`,
            `Mobile: ${u?.phone || 'not given'}`,
            '',
            'Documents:',
            ...docs.map((d) => `- ${d.slot.label}: ${d.document} (file: ${d.file.fileName})`),
            ...kyc.DOCUMENTS[type].slots.filter((s) => !docs.some((d) => d.slot.id === s.id)).map((s) => `- ${s.label}: not provided`),
            ...(note ? ['', `Note from the customer: ${note}`] : []),
        ].join('\n');

        const uploads = [];
        for (const d of docs) uploads.push(await zendesk.uploadToZendesk(d.file));
        const requesterId = await zendesk.zendeskUserFor(userId);
        const ticket = await zendesk.createZendeskTicket({
            requesterId,
            subject: kyc.TICKET_SUBJECT,
            body,
            uploads,
            tags: ['walras_console', 'kyc'],
        });
        await q(
            "UPDATE users SET kyc_status = 'pending', kyc_submitted_at = NOW(), kyc_ticket_id = ?, kyc_note = NULL WHERE id = ?",
            [ticket.id, userId]
        );
        const agentNote = `KYC: verify or reject this customer in Admin → Customers → KYC once the documents are checked.\n\n${await accountNote(userId)}`;
        await zendesk.addZendeskNote(ticket.id, agentNote)
            .catch((err) => console.warn(`KYC note failed on ticket ${ticket.id}:`, err.message));
        res.status(201).json({ ticketId: String(ticket.id), status: 'pending' });
    }),
};

module.exports = KycController;
