/**
 * Admin → Email customers (services/bulkEmail.js), plus the public
 * unsubscribe endpoint linked from "News & offers" emails.
 */
const connection = require('../config/db');
const bulk = require('../services/bulkEmail');
const audit = require('../utils/audit');
const { emailConfigured } = require('../utils/sendEmail');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        console.error(`Bulk email ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readCampaign = (body) => {
    const subject = String(body.subject || '').trim();
    const text = String(body.body || '').replace(/\r\n/g, '\n').trim();
    const category = body.category;
    const audience = body.audience;
    if (subject.length < 3 || subject.length > 200) throw new HttpError(400, 'Subject must be 3 to 200 characters.');
    if (text.length < 10 || text.length > 20000) throw new HttpError(400, 'Message must be 10 to 20,000 characters.');
    if (!bulk.CATEGORIES[category]) throw new HttpError(400, 'Choose the kind of email.');
    if (audience !== undefined && !bulk.AUDIENCES[audience]) throw new HttpError(400, 'Choose who receives it.');
    const targetUserId = Number(body.targetUserId);
    if (audience && bulk.AUDIENCES[audience].single && !(Number.isInteger(targetUserId) && targetUserId > 0)) {
        throw new HttpError(400, 'Choose the customer to email.');
    }
    return { subject, body: text, category, audience, targetUserId: Number.isInteger(targetUserId) ? targetUserId : null };
};

const idParam = (raw) => {
    if (!/^\d{1,10}$/.test(String(raw))) throw new HttpError(404, 'Not found.');
    return Number(raw);
};

const BulkEmailController = {
    // GET /api/admin/bulk-email — options, recipient counts, recent campaigns.
    overview: handle(async (req, res) => {
        const counts = {};
        for (const audience of Object.keys(bulk.AUDIENCES)) {
            if (bulk.AUDIENCES[audience].single) continue; // counted per customer
            counts[audience] = {};
            for (const category of Object.keys(bulk.CATEGORIES)) {
                counts[audience][category] = await bulk.countRecipients(audience, category);
            }
        }
        const campaigns = await q(
            `SELECT b.id, b.subject, b.category, b.audience, b.status, b.total, b.sent, b.failed, b.last_error,
                    b.created_by_name, b.created_at, b.finished_at, u.email AS target_email
             FROM bulk_emails b LEFT JOIN users u ON u.id = b.target_user_id
             ORDER BY b.created_at DESC LIMIT 20`,
        );
        res.json({
            emailConfigured,
            categories: bulk.CATEGORIES,
            audiences: Object.fromEntries(Object.entries(bulk.AUDIENCES).map(([k, v]) => [k, { label: v.label }])),
            counts,
            campaigns,
        });
    }),

    // POST /api/admin/bulk-email/test { to, subject, body, category }
    test: handle(async (req, res) => {
        const campaign = readCampaign(req.body);
        const to = String(req.body.to || '').trim();
        if (!EMAIL.test(to)) throw new HttpError(400, 'Enter an email address for the test.');
        try {
            await bulk.sendTest(to, campaign, req.admin.fullName || req.admin.username);
        } catch (err) {
            throw new HttpError(502, `The test email wasn't sent: ${err.message}`);
        }
        res.json({ message: `Test sent to ${to}.` });
    }),

    // POST /api/admin/bulk-email { subject, body, category, audience, expectedCount }
    send: handle(async (req, res) => {
        const campaign = readCampaign(req.body);
        if (!campaign.audience) throw new HttpError(400, 'Choose who receives it.');
        if (!emailConfigured && !(process.env.MAIL_DEV_LOG === 'true' && process.env.NODE_ENV !== 'production')) {
            throw new HttpError(503, 'Email is not configured on the server.');
        }
        const busy = await bulk.isBusy();
        if (busy) throw new HttpError(409, 'Another bulk email is still sending. Wait for it to finish or cancel it.');
        // The admin confirmed a number; don't send if the audience changed since.
        const count = await bulk.countRecipients(campaign.audience, campaign.category, campaign.targetUserId);
        if (count === 0) {
            throw new HttpError(400, bulk.AUDIENCES[campaign.audience].single
                ? (campaign.category === 'marketing' ? 'That customer has unsubscribed from news and offers.' : 'That customer has no email address.')
                : 'Nobody in that audience can receive this email.');
        }
        if (Number(req.body.expectedCount) !== count) {
            throw new HttpError(409, `The audience is now ${count} people. Check the number and confirm again.`);
        }
        const { id, total } = await bulk.start({
            ...campaign,
            admin: { id: req.admin.adminId, name: req.admin.fullName || req.admin.username },
        });
        audit(req, 'email.bulk_send', 'bulk_email', id, {
            subject: campaign.subject, category: campaign.category, audience: campaign.audience, targetUserId: campaign.targetUserId, total,
        });
        res.status(201).json({ id, total, message: `Sending to ${total} customers.` });
    }),

    // GET /api/admin/bulk-email/customers?q= — pick one recipient.
    customers: handle(async (req, res) => {
        const term = String(req.query.q || '').trim();
        if (term.length < 2) return res.json({ customers: [] });
        const rows = await bulk.findCustomers(term.slice(0, 100));
        res.json({
            customers: rows.map((u) => ({
                id: u.id, waladminId: u.waladmin_id || null, name: u.name, email: u.email,
                verified: Boolean(u.isemailverified), suspended: Boolean(u.suspended_at), unsubscribed: Boolean(u.marketing_opt_out),
            })),
        });
    }),

    cancel: handle(async (req, res) => {
        const id = idParam(req.params.id);
        if (!(await bulk.cancel(id))) throw new HttpError(409, 'That email is not sending.');
        audit(req, 'email.bulk_cancel', 'bulk_email', id);
        res.json({ message: 'Stopped. Nobody else will receive it.' });
    }),

    resume: handle(async (req, res) => {
        const id = idParam(req.params.id);
        const busy = await bulk.isBusy();
        if (busy) throw new HttpError(409, 'Another bulk email is still sending.');
        if (!(await bulk.resume(id))) throw new HttpError(409, 'Only an interrupted email can be resumed.');
        audit(req, 'email.bulk_resume', 'bulk_email', id);
        res.json({ message: 'Resumed where it stopped.' });
    }),

    // GET or POST /api/email/unsubscribe?u=&t= — public; POST is mail clients' one-click unsubscribe.
    unsubscribe: async (req, res) => {
        const userId = Number(req.query.u);
        const ok = Number.isInteger(userId) && userId > 0 && bulk.checkUnsubscribeToken(userId, req.query.t);
        if (ok) {
            await q('UPDATE users SET marketing_opt_out = TRUE WHERE id = ?', [userId]).catch((e) => console.error('Unsubscribe failed:', e.message));
        }
        if (req.method === 'POST') return res.status(ok ? 200 : 400).end();
        const site = (process.env.CLIENT_URL || 'https://www.walras.net').replace(/\/+$/, '');
        res.status(ok ? 200 : 400).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ok ? 'Unsubscribed' : 'Link not valid'} · Walras Cloud</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f2f2f3;font-family:Arial,Helvetica,sans-serif;color:#1d1f20;padding:16px;">
<div style="max-width:440px;background:#fff;border:1px solid #e3e5e4;border-radius:12px;padding:28px;">
<h1 style="margin:0 0 10px;font-size:22px;">${ok ? "You're unsubscribed" : 'This link is not valid'}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${ok
        ? "You won't receive news and offers from Walras Cloud any more. We'll still email you about your account and services."
        : 'Please use the unsubscribe link from a recent email, or contact support@walras.net.'}</p>
<a href="${site}" style="color:#037566;font-weight:700;">Go to Walras Cloud</a>
</div></body></html>`);
    },
};

module.exports = BulkEmailController;
