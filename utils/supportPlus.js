/**
 * Support +: priority phone support, ₹2,000 a month + GST.
 *
 * Charged up front: enabling it takes the full monthly price from the account
 * balance, whatever day it is (enabled on the 25th = the full ₹2,000 + GST for
 * the days to the 1st), and records a paid invoice. It runs until the 1st of
 * next month; from then it's a line on the account's monthly services invoice
 * issued on the 1st (utils/monthlyBilling.js). Cancelling takes effect at the end of the paid month (no refund
 * for the unused part). While the account is suspended for an unpaid
 * invoice, call-backs can't be requested.
 *
 * Call-backs (support_callbacks): the customer asks us to call them back;
 * an admin accepts the request (we call within 60 minutes) and marks it
 * completed afterwards, or declines it. One open request per account.
 */
const connection = require('../config/db');
const billing = require('./monthlyBilling');
const taxService = require('../services/taxServices');
const platformSettings = require('./platformSettings');
const integrations = require('./integrations');
const { sendRawEmail, escapeHtml } = require('./sendEmail');

const MONTHLY_PRICE = 200000; // paise: ₹2,000 a month, excluding GST
const CALL_WITHIN_MINUTES = 60;
const STATUSES = ['pending', 'accepted', 'completed', 'declined', 'cancelled'];
const ADMIN_STATUSES = ['pending', 'accepted', 'completed', 'declined'];

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const rowsOf = (r) => (Array.isArray(r) ? r : r?.rows || []);

class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (date) => `${new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })} IST`;

// ── The subscription ──────────────────────────────────────────────────────

const subscriptionOf = async (userId) => (await q('SELECT * FROM support_plus WHERE user_id = ?', [userId]))[0] || null;

const publicSubscription = (row) => (row?.status === 'active'
    ? {
        active: true,
        startedAt: row.started_at,
        paidUntil: row.paid_until,
        cancelAt: row.cancel_at,
        monthlyPrice: Number(row.monthly_price) / 100,
    }
    : { active: false, endedAt: row?.ended_at || null });

/** What enabling it now costs: the full monthly price plus GST, until the 1st. */
const quote = (user, now = new Date()) => {
    // Not pro rata: the full monthly price, whatever day it's enabled. It runs
    // from today to the 1st of next month, when the monthly invoice renews it.
    const rest = billing.proRata(MONTHLY_PRICE, now);
    const line = { ...rest, daysInMonth: rest.days, amount: MONTHLY_PRICE }; // shown as N/N days of the monthly price
    const tax = taxService.calculateTax(user || {}, line.amount);
    return {
        ...line,
        lines: [{ ...line, suffix: ` · until 1 ${billing.monthLabel(line.y, line.m + 1)}`, months: null }],
        subtotal: line.amount,
        tax,
        total: tax.totalAmount,
        paidUntil: billing.nextMonthStart(now),
        notes: `Support +, full monthly price, ${line.days} days until 1 ${billing.monthLabel(line.y, line.m + 1)}`,
    };
};

const publicQuote = (qt) => ({
    days: qt.days,
    daysInMonth: qt.daysInMonth,
    periodEnd: qt.periodEnd,
    amount: qt.subtotal / 100,
    tax: qt.tax.taxAmount / 100,
    total: qt.total / 100,
    paidUntil: qt.paidUntil,
});

/**
 * Turns Support + on: the full monthly price comes from the balance (only if it
 * covers it) and is recorded as a paid invoice.
 */
const enable = (userId, now = new Date()) => billing.withUserLock(userId, async () => {
    const current = await subscriptionOf(userId);
    if (current?.status === 'active') throw new HttpError(409, 'Support + is already on for this account.');
    if (await billing.hasOverdue(userId)) {
        throw new HttpError(402, 'You have an overdue invoice. Pay it in Billing → Invoices to enable Support +.', { overdue: true });
    }
    const [user] = await q('SELECT id, address, gstin FROM users WHERE id = ?', [userId]);
    await platformSettings.getInvoiceDetails(); // GST follows the seller GSTIN in Settings
    const qt = quote(user, now);

    if (!(await billing.chargeBalance(userId, qt.total))) {
        const [wallet] = await q('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
        throw new HttpError(402, `Your account balance is too low. Support+ costs ${rupees(qt.total)} now (${rupees(MONTHLY_PRICE)} + GST, until 1 ${billing.monthLabel(qt.y, qt.m + 1)}). Add funds and try again.`, {
            insufficient: true, required: qt.total / 100, available: Number(wallet?.balance || 0) / 100,
        });
    }
    // A new row, or an ended one started again; never a second active one.
    const claimed = rowsOf(await q(
        `INSERT INTO support_plus (user_id, status, monthly_price, started_at, paid_until, cancel_at, ended_at)
         VALUES (?, 'active', ?, ?, ?, NULL, NULL)
         ON CONFLICT (user_id) DO UPDATE SET status = 'active', monthly_price = EXCLUDED.monthly_price, started_at = EXCLUDED.started_at,
                paid_until = EXCLUDED.paid_until, cancel_at = NULL, ended_at = NULL
          WHERE support_plus.status = 'ended'
         RETURNING user_id`,
        [userId, MONTHLY_PRICE, now, qt.paidUntil],
    ));
    if (!claimed.length) {
        await billing.refundBalance(userId, qt.total);
        throw new HttpError(409, 'Support + is already on for this account.');
    }
    const invoice = await billing.recordPurchase({ userId, label: billing.SUPPORT_PLUS_LABEL, ref: 'SP', quote: qt, now })
        .catch((e) => { console.error(`[Support +] Invoice for user ${userId} failed:`, e.message); return null; });
    return { charged: qt.total / 100, paidUntil: qt.paidUntil, invoice: invoice?.number || null };
});

/** Cancels at the end of the paid month; it isn't renewed. Returns when it ends. */
const cancel = (userId, now = new Date()) => billing.withUserLock(userId, async () => {
    const row = await subscriptionOf(userId);
    if (row?.status !== 'active') throw new HttpError(404, "Support + isn't on for this account.");
    if (row.cancel_at) return row.cancel_at;
    const paidUntil = new Date(row.paid_until);
    const at = paidUntil > now ? paidUntil : billing.nextMonthStart(now);
    await q("UPDATE support_plus SET cancel_at = ? WHERE user_id = ? AND status = 'active'", [at, userId]);
    return at;
});

/** Undoes a cancellation that hasn't taken effect yet. */
const keep = (userId, now = new Date()) => billing.withUserLock(userId, async () => {
    const r = await q(
        "UPDATE support_plus SET cancel_at = NULL WHERE user_id = ? AND status = 'active' AND cancel_at IS NOT NULL AND cancel_at > ?",
        [userId, now],
    );
    if (!r.affectedRows) throw new HttpError(409, "There's no cancellation to undo.");
});

// ── Call-backs ────────────────────────────────────────────────────────────

const cleanPhone = (raw) => String(raw || '').trim().replace(/[\s\-().]/g, '');
const PHONE = /^\+?\d{7,15}$/;

const callBy = (r) => (r.status === 'accepted' && r.accepted_at
    ? new Date(new Date(r.accepted_at).getTime() + CALL_WITHIN_MINUTES * 60 * 1000) : null);

const publicCallback = (r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    note: r.note || '',
    status: r.status,
    reply: r.admin_note || '',
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
    closedAt: r.closed_at,
    callBy: callBy(r),
});

const listCallbacks = async (userId, limit = 10) => (await q(
    'SELECT * FROM support_callbacks WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    [userId, limit],
)).map(publicCallback);

/** A call-back request from the customer (actorId: the team member asking, if not the owner). */
const requestCallback = async ({ userId, actorId, name, phone, note }) => {
    const sub = await subscriptionOf(userId);
    if (sub?.status !== 'active') throw new HttpError(402, 'Enable Support + to request a call back.', { needsPlus: true });
    if (await billing.isSuspended(userId)) {
        throw new HttpError(402, 'Support + is paused while your services are suspended for an unpaid invoice. Pay it in Billing → Invoices.', { suspended: true });
    }
    const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
    const cleanNote = String(note || '').trim();
    const number = cleanPhone(phone);
    if (cleanName.length < 2 || cleanName.length > 100) throw new HttpError(400, 'Enter the name of the person we should ask for.');
    if (!PHONE.test(number)) throw new HttpError(400, 'Enter a valid phone number, e.g. +91 98765 43210.');
    if (cleanNote.length > 500) throw new HttpError(400, 'Keep the note under 500 characters.');
    try {
        const r = rowsOf(await q(
            'INSERT INTO support_callbacks (user_id, requested_by, name, phone, note) VALUES (?, ?, ?, ?, ?) RETURNING *',
            [userId, actorId || userId, cleanName, number, cleanNote || null],
        ));
        return publicCallback(r[0]);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw new HttpError(409, "You already have a call-back request open. We'll call you about that one, or cancel it to request a new one.");
        }
        throw err;
    }
};

const cancelCallback = async (userId, id) => {
    const r = rowsOf(await q(
        "UPDATE support_callbacks SET status = 'cancelled', closed_at = NOW() WHERE id = ? AND user_id = ? AND status IN ('pending', 'accepted') RETURNING *",
        [id, userId],
    ));
    if (!r.length) throw new HttpError(409, "This request can't be cancelled any more.");
    return publicCallback(r[0]);
};

// ── Admin ─────────────────────────────────────────────────────────────────

const STATUS_WORDS = { pending: 'Requested', accepted: 'Accepted', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled by customer' };

const adminRow = (r) => ({
    ...publicCallback(r),
    adminNote: r.admin_note || '',
    userId: r.user_id,
    accountName: r.account_name,
    accountEmail: r.account_email,
    company: r.company || '',
    waladminId: r.waladmin_id,
    requestedBy: r.requested_by && r.requested_by !== r.user_id ? r.requester_email : null,
    handledBy: r.handled_by_name || null,
    updatedAt: r.updated_at,
    plusActive: r.plus_status === 'active',
});

/** Requests for the admin page: open ones first (oldest first), then the rest, newest first. */
const adminList = async ({ status = 'open', search = '' } = {}) => {
    const where = [];
    const params = [];
    if (status === 'open') where.push("c.status IN ('pending', 'accepted')");
    else if (STATUSES.includes(status)) { where.push('c.status = ?'); params.push(status); }
    const term = String(search || '').trim().slice(0, 100);
    if (term) {
        where.push('(u.name ILIKE ? OR u.email ILIKE ? OR u.waladmin_id ILIKE ? OR c.name ILIKE ? OR c.phone ILIKE ?)');
        params.push(...Array(5).fill(`%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`));
    }
    const rows = await q(
        `SELECT c.*, u.name AS account_name, u.email AS account_email, u.company, u.waladmin_id, rq.email AS requester_email, sp.status AS plus_status
           FROM support_callbacks c
           JOIN users u ON u.id = c.user_id
           LEFT JOIN users rq ON rq.id = c.requested_by
           LEFT JOIN support_plus sp ON sp.user_id = c.user_id
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY CASE WHEN c.status IN ('pending', 'accepted') THEN 0 ELSE 1 END,
                   CASE WHEN c.status IN ('pending', 'accepted') THEN c.created_at END ASC,
                   c.created_at DESC
          LIMIT 200`,
        params,
    );
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of await q('SELECT status, COUNT(*)::int AS n FROM support_callbacks GROUP BY status')) counts[r.status] = r.n;
    const [subs] = await q("SELECT COUNT(*)::int AS n FROM support_plus WHERE status = 'active'");
    return { requests: rows.map(adminRow), counts, subscribers: subs?.n || 0 };
};

/** Active (and cancelling) Support + subscribers. */
const adminSubscribers = async () => (await q(
    `SELECT sp.*, u.name, u.email, u.company, u.waladmin_id,
            (SELECT COUNT(*)::int FROM support_callbacks c WHERE c.user_id = sp.user_id) AS requests
       FROM support_plus sp JOIN users u ON u.id = sp.user_id
      WHERE sp.status = 'active'
      ORDER BY sp.started_at DESC`,
)).map((r) => ({
    userId: r.user_id, name: r.name, email: r.email, company: r.company || '', waladminId: r.waladmin_id,
    startedAt: r.started_at, paidUntil: r.paid_until, cancelAt: r.cancel_at, monthlyPrice: Number(r.monthly_price) / 100, requests: r.requests,
}));

const siteUrl = () => (integrations.get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '');

/** Tells the person who asked for the call when it's accepted or declined. */
const emailCustomer = async (row) => {
    try {
        const [person] = await q('SELECT name, email FROM users WHERE id = ?', [row.requested_by || row.user_id]);
        if (!person?.email) return;
        const lines = row.status === 'accepted'
            ? [`Your call-back request has been accepted. We'll call ${row.name} on ${row.phone} within ${CALL_WITHIN_MINUTES} minutes, by ${fmtTime(callBy(row))}.`]
            : ["We're sorry, we couldn't take your call-back request this time.", 'You can request a call back again, or open a support ticket.'];
        if (row.admin_note) lines.push(`Note from Walras Support: ${row.admin_note}`);
        const subject = row.status === 'accepted' ? `We'll call you within ${CALL_WITHIN_MINUTES} minutes` : 'Your call-back request';
        const url = `${siteUrl()}/dashboard/support`;
        const text = [`Hi ${person.name || 'there'},`, '', ...lines, '', `Support +: ${url}`, '', 'Walras Cloud'].join('\n');
        const html = `<p>Hi ${escapeHtml(person.name || 'there')},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`
            + `<p><a href="${escapeHtml(url)}">Open Support +</a></p><p>Walras Cloud</p>`;
        await sendRawEmail({ to: person.email, subject, text, html });
    } catch (err) {
        console.error(`[Support +] Email for call-back ${row.id} failed:`, err.message);
    }
};

/**
 * An admin sets a request's status (and optionally a note the customer
 * sees). Accepting starts the 60-minute promise; moving back to pending
 * clears it. A request the customer cancelled stays cancelled.
 */
const adminSetStatus = async ({ id, status, note, admin }) => {
    if (!ADMIN_STATUSES.includes(status)) throw new HttpError(400, 'Choose a status.');
    const cleanNote = note === undefined || note === null ? undefined : String(note).trim();
    if (cleanNote !== undefined && cleanNote.length > 500) throw new HttpError(400, 'Keep the note under 500 characters.');
    const [cur] = await q('SELECT * FROM support_callbacks WHERE id = ?', [id]);
    if (!cur) throw new HttpError(404, 'Request not found.');
    if (cur.status === 'cancelled') throw new HttpError(409, 'The customer cancelled this request.');

    const acceptedAt = status === 'accepted' ? (cur.status === 'accepted' ? cur.accepted_at : new Date())
        : status === 'pending' ? null : cur.accepted_at;
    const closedAt = ['completed', 'declined'].includes(status) ? (cur.closed_at || new Date()) : null;
    let rows;
    try {
        rows = rowsOf(await q(
            `UPDATE support_callbacks
                SET status = ?, accepted_at = ?, closed_at = ?, admin_note = ?, handled_by = ?, handled_by_name = ?
              WHERE id = ? AND status = ?
             RETURNING *`,
            [status, acceptedAt, closedAt, cleanNote === undefined ? cur.admin_note : cleanNote || null,
                admin.id, (admin.name || '').slice(0, 100) || null, id, cur.status],
        ));
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'This customer has another open request. Close that one first.');
        throw err;
    }
    if (!rows.length) throw new HttpError(409, 'This request was just changed. Refresh and try again.');
    const row = rows[0];
    if (status !== cur.status && (status === 'accepted' || status === 'declined')) await emailCustomer(row);
    return { before: cur.status, request: publicCallback(row) };
};

/** Pending requests, newest first, for the admin notifications bell. */
const pendingForBell = () => q(
    `SELECT c.id, c.user_id, c.name, c.phone, c.created_at AS at, u.name AS account_name
       FROM support_callbacks c JOIN users u ON u.id = c.user_id
      WHERE c.status = 'pending' ORDER BY c.created_at DESC LIMIT 20`,
);

module.exports = {
    MONTHLY_PRICE, CALL_WITHIN_MINUTES, STATUSES, STATUS_WORDS, HttpError,
    subscriptionOf, publicSubscription, quote, publicQuote, enable, cancel, keep,
    listCallbacks, requestCallback, cancelCallback,
    adminList, adminSubscribers, adminSetStatus, pendingForBell,
};
