/**
 * Prepaid monthly billing for Virtual Machines.
 *
 * Buying a plan charges the rest of the current month up front, pro rata per
 * day (India time): monthly price ÷ days in the month × days left, counting
 * the day of purchase. It's paid from the account balance at checkout and
 * recorded as a paid invoice. servers.paid_until is then the start of next
 * month.
 *
 * On the 1st (00:00 IST) every server not yet paid for the new month is
 * renewed: one invoice per account for the full month ahead. The account
 * balance pays it first; the customer pays the rest through CCAvenue
 * (Billing → Invoices). In calendar days (India time) from the day the
 * invoice is issued (the 1st for renewals), while anything is still unpaid:
 *   1st  issued, due the same day
 *   3rd  10% late fee on the amount still unpaid (admins can waive it), and
 *        the account's servers are suspended (stopped)
 *   6th  final notice: services will be deleted tomorrow
 *   7th  the account's servers are deleted
 * Paying in full restarts the servers that suspension stopped.
 *
 * Reservations (TERMS): instead of monthly, a server can be reserved for
 * 3–36 months from the day it's bought, paid up front with savings, and
 * renewed automatically for the same term when it ends (servers.term_months,
 * paid_until = the end of the term). The 1st's monthly renewal skips them.
 *
 * Cancelling takes effect at the end of what's paid (the month, or the
 * reservation): the server keeps running until then, isn't renewed, and is
 * deleted. No refunds for an unused part.
 *
 * Amounts in paise, prices excluding GST. GST (services/taxServices.js) is
 * added on every invoice; the late fee is not taxed.
 */
const connection = require('../config/db');
const taxService = require('../services/taxServices');
const solusAccounts = require('./solusAccounts');
const stock = require('./computeStock');
const { sendRawEmail, escapeHtml } = require('./sendEmail');
const integrations = require('./integrations');

// The overdue timeline, in days after the day an invoice is issued (India
// time): issued on the 1st → due that day, late fee + suspension on the
// 3rd, final notice on the 6th, deletion on the 7th.
const LATE_FEE_RATE = 0.10;
const SUSPEND_DAY = 2;       // 1st + 2 = the 3rd (00:00 IST)
const DELETE_WARNING_DAY = 5; // the 6th
const DELETE_DAY = 6;        // the 7th

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const rowsOf = (r) => (Array.isArray(r) ? r : r?.rows || []);

const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── India time: month boundaries and days ────────────────────────────────

const IST_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const istParts = (date) => {
    const d = new Date(new Date(date).getTime() + IST_MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};
/** The instant month m of year y starts in India (m may overflow, e.g. 12 → next January). */
const monthStart = (y, m) => new Date(Date.UTC(y, m, 1) - IST_MS);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const istDay = (date) => Math.floor((new Date(date).getTime() + IST_MS) / DAY_MS);
const istDate = (dayNumber) => new Date(dayNumber * DAY_MS).toISOString().slice(0, 10); // YYYY-MM-DD
const monthLabel = (y, m) => new Date(Date.UTC(y, m, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtDay = (date) => new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });

/** The start of next month (India time): when a cancelled plan ends. */
const nextMonthStart = (now = new Date()) => {
    const { y, m } = istParts(now);
    return monthStart(y, m + 1);
};

/**
 * Billing terms. 1 = monthly (pro rata first month, renewed on the 1st);
 * the rest are reservations, paid up front from the day of purchase.
 * `savings` is the % off the monthly price for the whole term.
 */
const TERMS = [
    { months: 1, savings: 0 },
    { months: 3, savings: 0 },
    { months: 6, savings: 5 },
    { months: 12, savings: 10 },
    { months: 24, savings: 15 },
    { months: 36, savings: 25 },
];
const termFor = (months) => TERMS.find((t) => t.months === Number(months)) || null;

/** Midnight (India time) starting the day `date` falls on. */
const dayStartOf = (date) => new Date(istDay(date) * DAY_MS - IST_MS);

/**
 * The same day n months later (India time), at midnight; the 31st becomes the
 * last day of a shorter month. 5 Nov + 12 = 5 Nov next year.
 */
const addMonths = (date, n) => {
    const { y, m, d } = istParts(date);
    return new Date(Date.UTC(y, m + n, Math.min(d, daysInMonth(y, m + n))) - IST_MS);
};

/**
 * Pro rata line for a server from `from` to the end of that month (India
 * time), counting the day of `from`: e.g. bought on the 5th of a 30-day
 * month = 26 of 30 days. A full month when `from` is the 1st at 00:00.
 */
const proRata = (monthlyPaise, from) => {
    const { y, m } = istParts(from);
    const firstDay = istDay(from);
    const lastDay = istDay(monthStart(y, m + 1).getTime() - 1);
    const days = lastDay - firstDay + 1;
    const dim = daysInMonth(y, m);
    const monthly = Number(monthlyPaise);
    return {
        y, m,
        periodStart: istDate(firstDay),
        periodEnd: istDate(lastDay),
        days,
        daysInMonth: dim,
        monthlyPrice: monthly,
        amount: Math.round((monthly * days) / dim),
    };
};

// ── Per-account lock ─────────────────────────────────────────────────────
// Paying invoices from the balance and changing invoice totals happen one at
// a time per account, so two runs can't both spend the same balance.
const locks = new Map();
const withUserLock = (userId, fn) => {
    const key = Number(userId);
    const prev = locks.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    const tail = next.catch(() => {});
    locks.set(key, tail);
    tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
    return next;
};

// ── Emails ───────────────────────────────────────────────────────────────

const siteUrl = () => (integrations.get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '');
const invoicesUrl = () => `${siteUrl()}/dashboard/billing?tab=invoices`;

const email = async (userId, subject, lines, cta = 'View and pay your invoice') => {
    try {
        const [user] = await q('SELECT name, email FROM users WHERE id = ?', [userId]);
        if (!user?.email) return;
        const text = [`Hi ${user.name || 'there'},`, '', ...lines, '', `${cta}: ${invoicesUrl()}`, '', 'Walras Cloud'].join('\n');
        const html = `<p>Hi ${escapeHtml(user.name || 'there')},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`
            + `<p><a href="${escapeHtml(invoicesUrl())}">${escapeHtml(cta)}</a></p><p>Walras Cloud</p>`;
        await sendRawEmail({ to: user.email, subject, text, html });
    } catch (err) {
        console.error(`[Billing] Email "${subject}" to user ${userId} failed:`, err.message);
    }
};

// ── Servers: suspend, resume, delete ─────────────────────────────────────

const solusClient = (server) => solusAccounts.clientForAccountId(server.solus_account_id);

/**
 * Deletes a server for good: the VM on SolusVM, our record and its unit of
 * stock. If SolusVM can't delete it, nothing changes and the next run tries
 * again.
 */
const destroyServer = async (server) => {
    if (server.solus_server_id && server.solus_account_id) {
        try {
            await (await solusClient(server)).deleteServer(server.solus_server_id);
        } catch (err) {
            if (err.status !== 404) {
                console.error(`[Billing] Deleting server ${server.id} on SolusVM failed:`, err.message);
                return false;
            }
        }
    }
    await q('DELETE FROM servers WHERE id = ?', [server.id]);
    if (server.solus_server_id && server.location_id && (await stock.findPlan(server.plan_name, { all: true }))) {
        await stock.release(server.plan_name, server.location_id).catch((e) => console.error('[Billing] Stock return failed:', e.message));
    }
    return true;
};

/** Stops the account's running servers; they're marked so paying restarts them. */
const suspendServers = async (userId) => {
    const servers = await q("SELECT * FROM servers WHERE user_id = ? AND status IN ('active', 'deploying') AND suspended_at IS NULL", [userId]);
    for (const s of servers) {
        if (s.solus_server_id && s.solus_account_id) {
            await solusClient(s).then((c) => c.serverAction(s.solus_server_id, 'stop'))
                .catch((err) => console.error(`[Billing] Stopping server ${s.id} failed:`, err.message));
        }
        await q("UPDATE servers SET status = 'stopped', suspended_at = NOW() WHERE id = ?", [s.id]);
    }
    return servers.length;
};

/** Is the account suspended (an unpaid invoice past the suspension point)? */
const isSuspended = async (userId) => {
    const rows = await q(
        "SELECT 1 FROM monthly_invoices WHERE user_id = ? AND status <> 'paid' AND total_amount > amount_paid AND suspended_at IS NOT NULL LIMIT 1",
        [userId],
    );
    return rows.length > 0;
};

/** Has the account an unpaid invoice past its due time (late fee stage)? */
const hasOverdue = async (userId) => {
    const rows = await q(
        "SELECT 1 FROM monthly_invoices WHERE user_id = ? AND status <> 'paid' AND total_amount > amount_paid AND penalty_at IS NOT NULL LIMIT 1",
        [userId],
    );
    return rows.length > 0;
};

/** Once nothing suspends the account any more, restart what suspension stopped. */
const resumeIfClear = async (userId) => {
    if (await isSuspended(userId)) return 0;
    const servers = await q('SELECT * FROM servers WHERE user_id = ? AND suspended_at IS NOT NULL', [userId]);
    for (const s of servers) {
        if (s.solus_server_id && s.solus_account_id) {
            await solusClient(s).then((c) => c.serverAction(s.solus_server_id, 'start'))
                .catch((err) => console.error(`[Billing] Restarting server ${s.id} failed:`, err.message));
        }
        await q("UPDATE servers SET status = 'active', suspended_at = NULL WHERE id = ?", [s.id]);
    }
    if (servers.length) {
        await email(userId, 'Your servers are running again', [
            `Thanks for your payment. The ${servers.length === 1 ? 'server' : `${servers.length} servers`} we suspended ${servers.length === 1 ? 'has' : 'have'} been started again.`,
        ], 'View your invoices');
    }
    return servers.length;
};

// ── Paying from the account balance ──────────────────────────────────────

/**
 * Pays one invoice as far as the balance allows, in a single statement:
 * debits the wallet, adds to the invoice's amount_paid (marking it paid
 * when covered) and records the wallet transaction. Returns paise paid.
 */
const payFromBalance = async (userId, invoiceId) => {
    const rows = rowsOf(await q(
        `WITH amt AS (
            SELECT LEAST(w.balance, i.total_amount - i.amount_paid) AS a, w.id AS wallet_id, i.id AS invoice_id, i.invoice_number
              FROM wallets w JOIN monthly_invoices i ON i.user_id = w.user_id
             WHERE w.user_id = ? AND i.id = ? AND w.balance > 0 AND i.total_amount > i.amount_paid AND i.status <> 'paid'
         ),
         uw AS (
            UPDATE wallets w SET balance = w.balance - amt.a
              FROM amt WHERE w.id = amt.wallet_id AND w.balance >= amt.a
            RETURNING amt.a, amt.wallet_id, amt.invoice_id, amt.invoice_number
         ),
         ui AS (
            UPDATE monthly_invoices i
               SET amount_paid = i.amount_paid + uw.a,
                   status = CASE WHEN i.amount_paid + uw.a >= i.total_amount THEN 'paid' ELSE i.status END,
                   paid_at = CASE WHEN i.amount_paid + uw.a >= i.total_amount THEN NOW() ELSE i.paid_at END
              FROM uw WHERE i.id = uw.invoice_id
            RETURNING i.status
         ),
         tx AS (
            INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
            SELECT uw.wallet_id, 'debit', uw.a, CONCAT('Invoice ', uw.invoice_number, ' paid from account balance'), CONCAT('invoice_', uw.invoice_id), 'completed'
              FROM uw
            RETURNING id
         )
         SELECT uw.a AS paid, ui.status FROM uw, ui`,
        [userId, invoiceId],
    ));
    return rows[0] ? Number(rows[0].paid) : 0;
};

/**
 * Uses the account balance on unpaid invoices, oldest first (or `first`
 * first: the invoice a customer just paid for). Returns paise paid.
 */
const applyBalance = (userId, { first = null } = {}) => withUserLock(userId, async () => {
    const invoices = await q(
        "SELECT id FROM monthly_invoices WHERE user_id = ? AND status <> 'paid' AND total_amount > amount_paid AND subtotal IS NOT NULL ORDER BY billing_month, id",
        [userId],
    );
    if (first) invoices.sort((a, b) => (b.id === first) - (a.id === first));
    let paid = 0;
    for (const inv of invoices) {
        const n = await payFromBalance(userId, inv.id);
        if (!n) break;
        paid += n;
    }
    if (paid) await resumeIfClear(userId);
    return paid;
});

// ── Invoices ─────────────────────────────────────────────────────────────

const mm = (y, m) => `${y}${String(m + 1).padStart(2, '0')}`;
const billingMonthOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}-01`;
const serverLabel = (s) => `Virtual Machine ${s.hostname || s.name} (${s.plan_name || s.planName})`.slice(0, 255);

/** An invoice number not used yet: base, or base-2, base-3… */
const freeNumber = async (base) => {
    const taken = new Set((await q('SELECT invoice_number FROM monthly_invoices WHERE invoice_number = ? OR invoice_number LIKE ?', [base, `${base}-%`]))
        .map((r) => r.invoice_number));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
};

/** Inserts an invoice and its lines; returns the invoice id. */
const insertInvoice = async ({ userId, number, kind, y, m, lines, subtotal, tax, status, now, notes }) => {
    const paid = status === 'paid';
    const ins = rowsOf(await q(
        `INSERT INTO monthly_invoices (user_id, invoice_number, kind, billing_month, total_amount, subtotal, tax_amount, tax_breakdown,
                due_date, status, amount_paid, paid_at, generated_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [userId, number, kind, billingMonthOf(y, m), tax.totalAmount, subtotal, tax.taxAmount, JSON.stringify(tax.taxBreakdown || []),
            istDate(istDay(now)), status, paid ? tax.totalAmount : 0, paid ? now : null, now, notes],
    ));
    const invoiceId = ins[0].id;
    for (const l of lines) {
        await q(
            `INSERT INTO invoice_items (invoice_id, description, period_start, period_end, days, days_in_month, months, monthly_price, amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoiceId, l.description, l.periodStart, l.periodEnd, l.days, l.daysInMonth, l.months || null, l.monthlyPrice, l.amount],
        );
    }
    return invoiceId;
};

/**
 * Lines for a reservation of `term` from `from` (midnight India time): the
 * full price for the term, then the savings as a negative line.
 */
const reservationLines = (monthlyPaise, term, from) => {
    const to = addMonths(from, term.months);
    const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
    const gross = Number(monthlyPaise) * term.months;
    const savings = Math.round((gross * term.savings) / 100);
    const period = { periodStart: istDate(istDay(from)), periodEnd: istDate(istDay(to.getTime() - 1)) };
    const lines = [{ ...period, suffix: ` · ${term.months}-month reservation`, days, daysInMonth: days, months: term.months, monthlyPrice: Number(monthlyPaise), amount: gross }];
    if (savings) lines.push({ ...period, description: `Reservation savings (${term.savings}%)`, days: 0, daysInMonth: 0, months: null, monthlyPrice: 0, amount: -savings });
    return { lines, to, subtotal: gross - savings, savings };
};

/**
 * What buying a plan now costs, plus GST. Monthly (term 1): the rest of this
 * month, pro rata; paid until the 1st. A reservation: the whole term from
 * today, less its savings; paid until the same day `months` later.
 */
const quotePurchase = (user, monthlyRupees, now = new Date(), months = 1) => {
    const monthly = Math.round(Number(monthlyRupees) * 100);
    const term = termFor(months) || TERMS[0];
    const { y, m } = istParts(now);
    if (term.months === 1) {
        const line = proRata(monthly, now);
        const tax = taxService.calculateTax(user || {}, line.amount);
        return {
            ...line, term, lines: [{ ...line, suffix: '', months: null }], subtotal: line.amount, savings: 0, tax, total: tax.totalAmount,
            paidUntil: nextMonthStart(now), notes: `New server, ${line.days} of ${line.daysInMonth} days of ${monthLabel(y, m)}`,
        };
    }
    const r = reservationLines(monthly, term, dayStartOf(now));
    const tax = taxService.calculateTax(user || {}, r.subtotal);
    return {
        y, m, term, lines: r.lines, subtotal: r.subtotal, savings: r.savings, tax, total: tax.totalAmount, paidUntil: r.to,
        notes: `New server, ${term.months}-month reservation until ${istDate(istDay(r.to.getTime() - 1))}`,
    };
};

/**
 * Takes a purchase's price from the balance, only if it covers it.
 * Returns false (nothing taken) when it doesn't.
 */
const chargeBalance = async (userId, amount) => {
    if (amount <= 0) return true;
    const r = await q('UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND balance >= ?', [amount, userId, amount]);
    return r.affectedRows > 0;
};

/** Gives back a purchase charge (the server couldn't be created). */
const refundBalance = (userId, amount) => (amount > 0
    ? q('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId]) : Promise.resolve());

/**
 * Records a purchase that has been paid from the balance: a paid invoice
 * for the pro rata period and the wallet transaction.
 */
const recordPurchase = async ({ userId, server, quote, now = new Date() }) => {
    const number = await freeNumber(`WAL-${mm(quote.y, quote.m)}-${userId}-S${server.id}`);
    const lines = quote.lines.map((l) => ({ ...l, description: l.description || `${serverLabel(server)}${l.suffix || ''}` }));
    const invoiceId = await insertInvoice({
        userId, number, kind: 'purchase', y: quote.y, m: quote.m, lines, subtotal: quote.subtotal, tax: quote.tax,
        status: 'paid', now, notes: quote.notes,
    });
    if (quote.total > 0) {
        await q(
            `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
             SELECT id, 'debit', ?, ?, ?, 'completed' FROM wallets WHERE user_id = ?`,
            [quote.total, `${serverLabel(server)}: ${quote.notes.replace(/^New server, /, '')} (invoice ${number})`, `invoice_${invoiceId}`, userId],
        );
    }
    return { invoiceId, number };
};

/**
 * Renews every server not yet paid for the month `now` falls in: one
 * invoice per account for the full month. A server is claimed (paid_until
 * moved on) before its invoice is written, so a crash can't bill it twice.
 * Safe to run again. Returns the number of new invoices.
 */
const renewMonth = async (now = new Date()) => {
    const { y, m } = istParts(now);
    const start = monthStart(y, m);
    const next = monthStart(y, m + 1);
    const due = await q(
        `SELECT DISTINCT user_id FROM servers
          WHERE status <> 'failed' AND COALESCE(term_months, 1) = 1 AND created_at < ? AND (paid_until IS NULL OR paid_until <= ?) AND (cancel_at IS NULL OR cancel_at > ?)`,
        [start, start, start],
    );
    let created = 0;
    for (const { user_id: userId } of due) {
        try {
            const made = await withUserLock(userId, async () => {
                const claimed = rowsOf(await q(
                    `UPDATE servers SET paid_until = ?
                      WHERE user_id = ? AND status <> 'failed' AND COALESCE(term_months, 1) = 1 AND created_at < ? AND (paid_until IS NULL OR paid_until <= ?) AND (cancel_at IS NULL OR cancel_at > ?)
                     RETURNING id, name, hostname, plan_name, monthly_cost`,
                    [next, userId, start, start, start],
                ));
                if (!claimed.length) return null;
                const [user] = await q('SELECT id, name, email, address FROM users WHERE id = ?', [userId]);
                const lines = claimed.map((s) => ({ ...proRata(Math.round(Number(s.monthly_cost || 0) * 100), start), description: serverLabel(s) }));
                const subtotal = lines.reduce((n, l) => n + l.amount, 0);
                if (subtotal <= 0) return null;
                const tax = taxService.calculateTax(user || {}, subtotal);
                const number = await freeNumber(`WAL-${mm(y, m)}-${userId}`);
                await insertInvoice({ userId, number, kind: 'renewal', y, m, lines, subtotal, tax, status: 'pending', now, notes: `Renewal for ${monthLabel(y, m)}` });
                return { number, lines, subtotal, tax };
            });
            if (!made) continue;
            created += 1;

            const paidFromBalance = await applyBalance(userId);
            const due = made.tax.totalAmount - paidFromBalance;
            const { suspendAt, deleteAt } = deadlines({ generated_at: now });
            await email(userId, due > 0
                ? `Your Walras Cloud renewal for ${monthLabel(y, m)}: ${rupees(due)} due`
                : `Your Walras Cloud renewal for ${monthLabel(y, m)} is paid`, [
                `Invoice ${made.number} renews your services for ${monthLabel(y, m)}: ${rupees(made.tax.totalAmount)} (${rupees(made.subtotal)} + ${rupees(made.tax.taxAmount)} GST).`,
                ...made.lines.map((l) => `• ${l.description}: ${rupees(l.amount)}`),
                ...(paidFromBalance ? [`${rupees(paidFromBalance)} was paid from your account balance.`] : []),
                ...(due > 0 ? [
                    `Please pay the remaining ${rupees(due)} today.`,
                    `If it's still unpaid on ${fmtDay(suspendAt)}, a ${Math.round(LATE_FEE_RATE * 100)}% late fee is added on the unpaid amount and your services are suspended; on ${fmtDay(deleteAt)} they are deleted.`,
                ] : []),
            ]);
        } catch (err) {
            console.error(`[Billing] Renewal for user ${userId} (${monthLabel(y, m)}) failed:`, err.message);
        }
    }
    if (created) console.log(`[Billing] Issued ${created} renewal invoice(s) for ${monthLabel(y, m)}`);
    return created;
};

/**
 * Renews reservations whose term has ended: the same term again, from the
 * end of the last one, at the same savings. One invoice per server. The
 * server is claimed (paid_until moved on) first, so it can't be billed twice.
 */
const renewReservations = async (now = new Date()) => {
    const due = await q(
        `SELECT * FROM servers
          WHERE COALESCE(term_months, 1) > 1 AND status <> 'failed' AND paid_until IS NOT NULL AND paid_until <= ?
            AND (cancel_at IS NULL OR cancel_at > paid_until)`,
        [now],
    );
    let created = 0;
    for (const s of due) {
        try {
            const made = await withUserLock(s.user_id, async () => {
                const term = termFor(s.term_months) || { months: Number(s.term_months), savings: 0 };
                const from = new Date(s.paid_until);
                const r = reservationLines(Math.round(Number(s.monthly_cost || 0) * 100), term, from);
                const claimed = rowsOf(await q('UPDATE servers SET paid_until = ? WHERE id = ? AND paid_until = ? RETURNING id', [r.to, s.id, from]));
                if (!claimed.length || r.subtotal <= 0) return null;
                const [user] = await q('SELECT id, name, email, address FROM users WHERE id = ?', [s.user_id]);
                const tax = taxService.calculateTax(user || {}, r.subtotal);
                const { y, m } = istParts(from);
                const number = await freeNumber(`WAL-${mm(y, m)}-${s.user_id}-R${s.id}`);
                const lines = r.lines.map((l) => ({ ...l, description: l.description || `${serverLabel(s)}${l.suffix}` }));
                await insertInvoice({
                    userId: s.user_id, number, kind: 'renewal', y, m, lines, subtotal: r.subtotal, tax, status: 'pending', now,
                    notes: `Reservation renewal: ${term.months} months until ${istDate(istDay(r.to.getTime() - 1))}`,
                });
                return { number, term, tax, to: r.to, label: serverLabel(s) };
            });
            if (!made) continue;
            created += 1;
            const paidFromBalance = await applyBalance(s.user_id);
            const due2 = made.tax.totalAmount - paidFromBalance;
            const { suspendAt, deleteAt } = deadlines({ generated_at: now });
            await email(s.user_id, due2 > 0 ? `Your reservation renewed: ${rupees(due2)} due` : 'Your reservation renewed', [
                `${made.label} has been reserved for another ${made.term.months} months, until ${fmtDay(new Date(made.to.getTime() - 1))} (invoice ${made.number}, ${rupees(made.tax.totalAmount)}).`,
                ...(paidFromBalance ? [`${rupees(paidFromBalance)} was paid from your account balance.`] : []),
                ...(due2 > 0 ? [
                    `Please pay the remaining ${rupees(due2)} today.`,
                    `If it's still unpaid on ${fmtDay(suspendAt)}, a ${Math.round(LATE_FEE_RATE * 100)}% late fee is added on the unpaid amount and your services are suspended; on ${fmtDay(deleteAt)} they are deleted.`,
                ] : []),
            ]);
        } catch (err) {
            console.error(`[Billing] Reservation renewal for server ${s.id} failed:`, err.message);
        }
    }
    if (created) console.log(`[Billing] Renewed ${created} reservation(s)`);
    return created;
};

// ── Cancellations ────────────────────────────────────────────────────────

/**
 * Cancel a plan: the server runs to the end of the month it's paid for and
 * is deleted then (not renewed).
 */
const scheduleCancel = async (server, now = new Date()) => {
    const paidUntil = server.paid_until ? new Date(server.paid_until) : null;
    const at = paidUntil && paidUntil > now ? paidUntil : nextMonthStart(now);
    await q('UPDATE servers SET cancel_at = ? WHERE id = ?', [at, server.id]);
    return at;
};

const undoCancel = (server) => q('UPDATE servers SET cancel_at = NULL WHERE id = ?', [server.id]);

/** Deletes servers whose cancellation date has come. */
const processCancellations = async (now = new Date()) => {
    const due = await q('SELECT * FROM servers WHERE cancel_at IS NOT NULL AND cancel_at <= ?', [now]);
    for (const s of due) {
        try {
            if (await destroyServer(s)) console.log(`[Billing] Cancelled plan ended: server ${s.id} deleted`);
        } catch (err) {
            console.error(`[Billing] Cancelling server ${s.id} failed:`, err.message);
        }
    }
};

// ── The overdue timeline ─────────────────────────────────────────────────

/** 10% of what's still unpaid when the fee is added. */
const lateFeeFor = (inv) => Math.round(Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid)) * LATE_FEE_RATE);

const enforceInvoice = (inv, now) => withUserLock(inv.user_id, async () => {
    const [cur] = await q('SELECT * FROM monthly_invoices WHERE id = ?', [inv.id]);
    if (!cur || cur.status === 'paid' || Number(cur.total_amount) <= Number(cur.amount_paid)) return;
    const { suspendAt, warnAt, deleteAt } = deadlines(cur);
    const label = cur.invoice_number;

    // The 3rd: late fee on what's unpaid, and suspension, together.
    if (now >= suspendAt && !cur.penalty_at) {
        const fee = cur.penalty_waived ? 0 : lateFeeFor(cur);
        await q(
            `UPDATE monthly_invoices SET penalty_amount = ?, total_amount = subtotal + tax_amount + ?, penalty_at = ?, status = 'overdue'
              WHERE id = ? AND penalty_at IS NULL`,
            [fee, fee, now, cur.id],
        );
        const due = Number(cur.total_amount) + fee - Number(cur.amount_paid);
        await q('UPDATE monthly_invoices SET suspended_at = ? WHERE id = ? AND suspended_at IS NULL', [now, cur.id]);
        const n = await suspendServers(cur.user_id);
        await email(cur.user_id, `Invoice ${label} is overdue: services suspended`, [
            fee ? `Invoice ${label} wasn't paid on time, so a ${Math.round(LATE_FEE_RATE * 100)}% late fee of ${rupees(fee)} has been added on the unpaid amount.`
                : `Invoice ${label} wasn't paid on time.`,
            `${n ? `Your ${n === 1 ? 'server has' : `${n} servers have`} been suspended (stopped). ` : ''}${rupees(due)} is now due; paying it starts them again.`,
            `If it's still unpaid on ${fmtDay(deleteAt)}, your servers and their data will be deleted permanently.`,
        ], 'Pay your invoice');
    } else if (now >= suspendAt && !cur.suspended_at) {
        await q('UPDATE monthly_invoices SET suspended_at = ? WHERE id = ?', [now, cur.id]);
        await suspendServers(cur.user_id);
    }
    if (now >= warnAt && now < deleteAt && !cur.delete_warned_at) {
        await q('UPDATE monthly_invoices SET delete_warned_at = ? WHERE id = ?', [now, cur.id]);
        await email(cur.user_id, 'Final notice: your servers will be deleted tomorrow', [
            `Invoice ${label} is still unpaid. Your servers and all their data will be deleted permanently on ${fmtDay(deleteAt)}.`,
            'Pay the invoice before then to keep them; they start again as soon as it is paid.',
        ], 'Pay your invoice');
    }
    if (now >= deleteAt && !cur.services_deleted_at) {
        const servers = await q('SELECT * FROM servers WHERE user_id = ?', [cur.user_id]);
        let deleted = 0;
        for (const s of servers) if (await destroyServer(s)) deleted += 1;
        if (deleted === servers.length) await q('UPDATE monthly_invoices SET services_deleted_at = ? WHERE id = ?', [now, cur.id]);
        if (deleted) {
            await email(cur.user_id, 'Your servers have been deleted', [
                `Invoice ${label} was still unpaid, so your ${deleted === 1 ? 'server and its data have' : `${deleted} servers and their data have`} been deleted.`,
                'The invoice is still due. Please pay it to keep using Walras Cloud.',
            ], 'Pay your invoice');
        }
    }
});

let running = false;

/**
 * One pass (every 15 minutes, and on the 1st at 00:00 IST): end cancelled
 * plans, renew servers not yet paid for this month, pay what balances allow,
 * then apply the overdue timeline.
 */
const run = async (now = new Date()) => {
    if (running) return;
    running = true;
    try {
        await processCancellations(now);
        await renewMonth(now);
        await renewReservations(now);

        const withBalance = await q(
            `SELECT DISTINCT i.user_id FROM monthly_invoices i JOIN wallets w ON w.user_id = i.user_id
              WHERE i.status <> 'paid' AND i.total_amount > i.amount_paid AND i.subtotal IS NOT NULL AND w.balance > 0`,
        );
        for (const { user_id: userId } of withBalance) await applyBalance(userId).catch((e) => console.error('[Billing] Balance payment failed:', e.message));

        const unpaid = await q(
            "SELECT id, user_id FROM monthly_invoices WHERE status <> 'paid' AND total_amount > amount_paid AND subtotal IS NOT NULL AND generated_at <= ?",
            [new Date(now.getTime() - SUSPEND_DAY * DAY_MS + DAY_MS)], // issued at least a day ago; enforceInvoice checks the exact dates
        );
        for (const inv of unpaid) await enforceInvoice(inv, now).catch((e) => console.error(`[Billing] Overdue step for invoice ${inv.id} failed:`, e.message));
    } catch (err) {
        console.error('[Billing] Run failed:', err.message);
    } finally {
        running = false;
    }
};

// ── Admin actions ────────────────────────────────────────────────────────

/** Removes the late fee (before or after it was added). Overpayment goes back to the balance. */
const waiveLateFee = (invoiceId) => q('SELECT user_id FROM monthly_invoices WHERE id = ?', [invoiceId]).then(async ([inv]) => {
    if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    return withUserLock(inv.user_id, async () => {
        const [cur] = await q('SELECT * FROM monthly_invoices WHERE id = ?', [invoiceId]);
        if (cur.subtotal === null) throw Object.assign(new Error('This invoice is from before monthly billing and has no late fee.'), { status: 409 });
        const base = Number(cur.subtotal) + Number(cur.tax_amount);
        const paid = Number(cur.amount_paid);
        const refund = Math.max(0, paid - base);
        const status = paid >= base ? 'paid' : cur.penalty_at ? 'overdue' : 'pending';
        await q(
            `UPDATE monthly_invoices SET penalty_amount = 0, penalty_waived = TRUE, total_amount = ?, amount_paid = ?, status = ?,
                    paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END
              WHERE id = ?`,
            [base, paid - refund, status, status, invoiceId],
        );
        if (refund) {
            await q('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [refund, cur.user_id]);
            await q(
                `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
                 SELECT id, 'credit', ?, ?, ?, 'completed' FROM wallets WHERE user_id = ?`,
                [refund, `Late fee on ${cur.invoice_number} waived`, `invoice_${invoiceId}_waiver`, cur.user_id],
            );
        }
        if (status === 'paid') await resumeIfClear(cur.user_id);
        return { refund, status, userId: cur.user_id, fee: Number(cur.penalty_amount) };
    });
});

/** Marks an invoice paid in full (e.g. a bank transfer received outside Walras). */
const markPaid = (invoiceId) => q('SELECT user_id FROM monthly_invoices WHERE id = ?', [invoiceId]).then(async ([inv]) => {
    if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    return withUserLock(inv.user_id, async () => {
        await q("UPDATE monthly_invoices SET amount_paid = total_amount, status = 'paid', paid_at = COALESCE(paid_at, NOW()) WHERE id = ?", [invoiceId]);
        await resumeIfClear(inv.user_id);
        return { userId: inv.user_id };
    });
});

// ── For the customer ─────────────────────────────────────────────────────

/** What the next renewal (on the 1st) will be, excluding GST. */
const nextRenewal = async (userId, now = new Date()) => {
    const next = nextMonthStart(now);
    const [r] = await q(
        `SELECT COALESCE(SUM(ROUND(COALESCE(monthly_cost, 0) * 100)), 0) AS total FROM servers
          WHERE user_id = ? AND status <> 'failed' AND COALESCE(term_months, 1) = 1 AND (cancel_at IS NULL OR cancel_at > ?)`,
        [userId, next],
    );
    return Number(r?.total || 0);
};

/** Deadlines of an invoice, for display. */
const deadlines = (inv) => {
    // Midnight (India time) starting the day the invoice was issued.
    const dayStart = istDay(inv.generated_at) * DAY_MS - IST_MS;
    const day = (n) => new Date(dayStart + n * DAY_MS);
    return { payBy: day(1), suspendAt: day(SUSPEND_DAY), warnAt: day(DELETE_WARNING_DAY), deleteAt: day(DELETE_DAY) };
};

const publicInvoice = (inv) => ({
    id: inv.id,
    number: inv.invoice_number,
    kind: inv.kind || 'renewal',
    month: inv.billing_month,
    issuedAt: inv.generated_at,
    subtotal: inv.subtotal === null ? null : Number(inv.subtotal) / 100,
    tax: Number(inv.tax_amount || 0) / 100,
    lateFee: Number(inv.penalty_amount || 0) / 100,
    lateFeeWaived: Boolean(inv.penalty_waived),
    total: Number(inv.total_amount) / 100,
    paid: Number(inv.amount_paid || 0) / 100,
    due: Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid || 0)) / 100,
    status: inv.status,
    paidAt: inv.paid_at,
    suspended: Boolean(inv.suspended_at) && inv.status !== 'paid',
    ...(inv.subtotal === null ? {} : (({ payBy, suspendAt, deleteAt }) => ({ payBy, suspendAt, deleteAt }))(deadlines(inv))),
});

module.exports = {
    LATE_FEE_RATE, SUSPEND_DAY, DELETE_DAY, deadlines,
    // dates
    istParts, monthStart, daysInMonth, nextMonthStart, proRata, addMonths, TERMS, termFor,
    // servers
    destroyServer, isSuspended, hasOverdue, resumeIfClear,
    // purchase
    quotePurchase, chargeBalance, refundBalance, recordPurchase,
    // invoices
    renewMonth, renewReservations, applyBalance, payFromBalance, run, processCancellations, scheduleCancel, undoCancel,
    waiveLateFee, markPaid, nextRenewal, publicInvoice, withUserLock,
};
