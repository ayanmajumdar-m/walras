/**
 * Postpaid monthly billing.
 *
 * Services are used first and billed on the 1st of the next month (India
 * time), pro rata per day: monthly price ÷ days in the month × days the
 * service existed that month (any part of a day counts as a day). Each
 * service's billing record lives in service_usage, so a server deleted
 * mid-month is still billed for the days it ran.
 *
 * On the 1st, the account balance pays the invoice first; the customer pays
 * the rest through CCAvenue (Billing → Invoices). Counted from when the
 * invoice was issued, while anything is still unpaid:
 *   48 hours  10% late fee added (of the invoice value; admins can waive it)
 *   72 hours  the account's servers are suspended (stopped)
 *   96 hours  warning email: services will be deleted in 24 hours
 *   5 days    the account's servers are deleted
 * Paying in full restarts the servers that suspension stopped.
 *
 * Cancelling a plan takes effect at the end of the month: the server keeps
 * running, is billed to the end of the month and is deleted on the 1st.
 *
 * Amounts in paise, prices excluding GST. GST (services/taxServices.js) is
 * added on the invoice; the late fee is not taxed.
 */
const connection = require('../config/db');
const taxService = require('../services/taxServices');
const solusAccounts = require('./solusAccounts');
const stock = require('./computeStock');
const { sendRawEmail, escapeHtml } = require('./sendEmail');
const integrations = require('./integrations');

const PAY_WITHIN_HOURS = 48;
const LATE_FEE_RATE = 0.10;
const SUSPEND_AFTER_HOURS = 72;
const DELETE_WARNING_HOURS = 96;
const DELETE_AFTER_HOURS = 5 * 24;

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
const fmtIst = (date) => new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The month before the one `now` falls in (India time). */
const previousMonth = (now = new Date()) => {
    const { y, m } = istParts(now);
    return m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
};

/** The start of next month (India time): when a cancelled plan ends. */
const nextMonthStart = (now = new Date()) => {
    const { y, m } = istParts(now);
    return monthStart(y, m + 1);
};

/**
 * The invoice line for one usage record in month (y, m), or null if it
 * didn't run that month. `until` caps the period (estimates to date).
 */
const lineFor = (usage, y, m, until = null) => {
    const from = new Date(Math.max(new Date(usage.started_at).getTime(), monthStart(y, m).getTime()));
    let to = monthStart(y, m + 1).getTime();
    if (usage.ended_at) to = Math.min(to, new Date(usage.ended_at).getTime());
    if (until) to = Math.min(to, new Date(until).getTime());
    if (to <= from.getTime()) return null;
    const firstDay = istDay(from);
    const lastDay = istDay(to - 1);
    const days = lastDay - firstDay + 1;
    const dim = daysInMonth(y, m);
    const monthly = Number(usage.monthly_price);
    return {
        usageId: usage.id,
        description: usage.label,
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

// ── Usage records ────────────────────────────────────────────────────────

/** A server starts being billed (called when it's created). */
const startUsage = (server) => q(
    `INSERT INTO service_usage (user_id, kind, ref_id, label, plan_name, monthly_price, started_at)
     VALUES (?, 'vm', ?, ?, ?, ?, ?)`,
    [server.userId, server.id, `Virtual Machine ${server.hostname} (${server.planName})`.slice(0, 160), server.planName,
        Math.round(Number(server.monthlyRupees) * 100), server.startedAt || new Date()],
);

/** A server stops being billed at `at`. */
const endUsage = (serverId, at = new Date()) => q(
    "UPDATE service_usage SET ended_at = ? WHERE kind = 'vm' AND ref_id = ? AND ended_at IS NULL",
    [at, serverId],
);

/** Removes a usage record for a server that was never created (failed deploy). */
const discardUsage = (serverId) => q("DELETE FROM service_usage WHERE kind = 'vm' AND ref_id = ? AND ended_at IS NULL", [serverId]);

// ── Servers: suspend, resume, delete ─────────────────────────────────────

const solusClient = (server) => solusAccounts.clientForAccountId(server.solus_account_id);

/**
 * Deletes a server for good: the VM on SolusVM, our record, its unit of
 * stock; billing stops at `endAt`. If SolusVM can't delete it, nothing
 * changes and the next run tries again (so we never stop billing a VM
 * that's still running).
 */
const destroyServer = async (server, endAt = new Date()) => {
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
    await endUsage(server.id, endAt);
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

// ── Generating invoices ──────────────────────────────────────────────────

/** Lines and totals for one account in month (y, m). */
const buildInvoice = (usages, user, y, m, until = null) => {
    const lines = usages.map((u) => lineFor(u, y, m, until)).filter(Boolean);
    const subtotal = lines.reduce((n, l) => n + l.amount, 0);
    const tax = taxService.calculateTax(user || {}, subtotal);
    return { lines, subtotal, tax };
};

/**
 * Issues the invoices for month (y, m): one per account that used anything.
 * Safe to run again (one invoice per account per month). Returns the number
 * of new invoices.
 */
const generateForMonth = async (y, m, now = new Date()) => {
    const start = monthStart(y, m);
    const end = monthStart(y, m + 1);
    if (now < end) throw new Error(`${monthLabel(y, m)} hasn't ended yet.`);
    const billingMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const usages = await q('SELECT * FROM service_usage WHERE started_at < ? AND (ended_at IS NULL OR ended_at > ?) ORDER BY started_at, id', [end, start]);
    const invoiced = new Set((await q('SELECT user_id FROM monthly_invoices WHERE billing_month = ?', [billingMonth])).map((r) => r.user_id));
    const byUser = new Map();
    for (const u of usages) {
        if (invoiced.has(u.user_id)) continue;
        if (!byUser.has(u.user_id)) byUser.set(u.user_id, []);
        byUser.get(u.user_id).push(u);
    }
    const dueAt = new Date(now.getTime() + PAY_WITHIN_HOURS * 3600 * 1000);
    let created = 0;

    for (const [userId, list] of byUser) {
        try {
            const [user] = await q('SELECT id, name, email, address FROM users WHERE id = ?', [userId]);
            if (!user) continue;
            const { lines, subtotal, tax } = buildInvoice(list, user, y, m);
            if (subtotal <= 0) continue;
            const number = `WAL-${y}${String(m + 1).padStart(2, '0')}-${userId}`;
            const ins = rowsOf(await q(
                `INSERT INTO monthly_invoices (user_id, invoice_number, billing_month, total_amount, subtotal, tax_amount, tax_breakdown,
                        due_date, status, generated_at, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                 ON CONFLICT (user_id, billing_month) DO NOTHING
                 RETURNING id`,
                [userId, number, billingMonth, tax.totalAmount, subtotal, tax.taxAmount, JSON.stringify(tax.taxBreakdown || []),
                    istDate(istDay(dueAt)), now, `Services used in ${monthLabel(y, m)}`],
            ));
            if (!ins.length) continue; // already issued
            const invoiceId = ins[0].id;
            for (const l of lines) {
                await q(
                    `INSERT INTO invoice_items (invoice_id, usage_id, description, period_start, period_end, days, days_in_month, monthly_price, amount)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [invoiceId, l.usageId, l.description, l.periodStart, l.periodEnd, l.days, l.daysInMonth, l.monthlyPrice, l.amount],
                );
            }
            created += 1;

            const paidFromBalance = await applyBalance(userId);
            const due = tax.totalAmount - paidFromBalance;
            await email(userId, due > 0
                ? `Your Walras Cloud invoice for ${monthLabel(y, m)}: ${rupees(due)} due`
                : `Your Walras Cloud invoice for ${monthLabel(y, m)} is paid`, [
                `Your invoice ${number} for ${monthLabel(y, m)} is ${rupees(tax.totalAmount)} (${rupees(subtotal)} + ${rupees(tax.taxAmount)} GST).`,
                ...lines.map((l) => `• ${l.description}: ${l.days} of ${l.daysInMonth} days, ${rupees(l.amount)}`),
                ...(paidFromBalance ? [`${rupees(paidFromBalance)} was paid from your account balance.`] : []),
                ...(due > 0 ? [
                    `Please pay the remaining ${rupees(due)} by ${fmtIst(dueAt)} (IST).`,
                    `After that a ${Math.round(LATE_FEE_RATE * 100)}% late fee is added; services are suspended ${SUSPEND_AFTER_HOURS} hours after the invoice and deleted after ${DELETE_AFTER_HOURS / 24} days if it's still unpaid.`,
                ] : []),
            ]);
        } catch (err) {
            console.error(`[Billing] Invoice for user ${userId} (${monthLabel(y, m)}) failed:`, err.message);
        }
    }
    if (created) console.log(`[Billing] Issued ${created} invoice(s) for ${monthLabel(y, m)}`);
    return created;
};

// ── Cancellations ────────────────────────────────────────────────────────

/** Cancel a plan: the server is deleted when this month ends (India time). */
const scheduleCancel = async (server, now = new Date()) => {
    const at = nextMonthStart(now);
    await q('UPDATE servers SET cancel_at = ? WHERE id = ?', [at, server.id]);
    return at;
};

const undoCancel = (server) => q('UPDATE servers SET cancel_at = NULL WHERE id = ?', [server.id]);

/** Deletes servers whose cancellation date has come; billing ends at that date. */
const processCancellations = async (now = new Date()) => {
    const due = await q('SELECT * FROM servers WHERE cancel_at IS NOT NULL AND cancel_at <= ?', [now]);
    for (const s of due) {
        try {
            // The customer cancelled: billing ends then, even if deleting the
            // VM has to be retried.
            await endUsage(s.id, new Date(s.cancel_at));
            if (await destroyServer(s, new Date(s.cancel_at))) console.log(`[Billing] Cancelled plan ended: server ${s.id} deleted`);
        } catch (err) {
            console.error(`[Billing] Cancelling server ${s.id} failed:`, err.message);
        }
    }
};

// ── The overdue timeline ─────────────────────────────────────────────────

const hoursSince = (date, now) => (now.getTime() - new Date(date).getTime()) / 3600000;

const lateFeeFor = (inv) => Math.round((Number(inv.subtotal) + Number(inv.tax_amount)) * LATE_FEE_RATE);

const enforceInvoice = (inv, now) => withUserLock(inv.user_id, async () => {
    const [cur] = await q('SELECT * FROM monthly_invoices WHERE id = ?', [inv.id]);
    if (!cur || cur.status === 'paid' || Number(cur.total_amount) <= Number(cur.amount_paid)) return;
    const age = hoursSince(cur.generated_at, now);
    const label = cur.invoice_number;

    if (age >= PAY_WITHIN_HOURS && !cur.penalty_at) {
        const fee = cur.penalty_waived ? 0 : lateFeeFor(cur);
        await q(
            `UPDATE monthly_invoices SET penalty_amount = ?, total_amount = subtotal + tax_amount + ?, penalty_at = ?, status = 'overdue'
              WHERE id = ? AND penalty_at IS NULL`,
            [fee, fee, now, cur.id],
        );
        const due = Number(cur.subtotal) + Number(cur.tax_amount) + fee - Number(cur.amount_paid);
        await email(cur.user_id, `Invoice ${label} is overdue`, [
            fee ? `Invoice ${label} wasn't paid within ${PAY_WITHIN_HOURS} hours, so a ${Math.round(LATE_FEE_RATE * 100)}% late fee of ${rupees(fee)} has been added.`
                : `Invoice ${label} wasn't paid within ${PAY_WITHIN_HOURS} hours.`,
            `${rupees(due)} is now due. If it isn't paid within ${SUSPEND_AFTER_HOURS} hours of the invoice your servers will be suspended.`,
        ], 'Pay your invoice');
    }
    if (age >= SUSPEND_AFTER_HOURS && !cur.suspended_at) {
        await q('UPDATE monthly_invoices SET suspended_at = ? WHERE id = ?', [now, cur.id]);
        const n = await suspendServers(cur.user_id);
        await email(cur.user_id, 'Your Walras Cloud services are suspended', [
            `Invoice ${label} is still unpaid, so your ${n === 1 ? 'server has' : 'servers have'} been suspended (stopped).`,
            `Pay the invoice to start them again. If it's still unpaid ${DELETE_AFTER_HOURS / 24} days after the invoice, your servers and their data will be deleted permanently.`,
        ], 'Pay your invoice');
    }
    if (age >= DELETE_WARNING_HOURS && !cur.delete_warned_at && age < DELETE_AFTER_HOURS) {
        await q('UPDATE monthly_invoices SET delete_warned_at = ? WHERE id = ?', [now, cur.id]);
        const at = new Date(new Date(cur.generated_at).getTime() + DELETE_AFTER_HOURS * 3600 * 1000);
        await email(cur.user_id, 'Final notice: your servers will be deleted in 24 hours', [
            `Invoice ${label} is still unpaid. Your servers and all their data will be deleted permanently on ${fmtIst(at)} (IST).`,
            'Pay the invoice before then to keep them; they start again as soon as it is paid.',
        ], 'Pay your invoice');
    }
    if (age >= DELETE_AFTER_HOURS && !cur.services_deleted_at) {
        const servers = await q('SELECT * FROM servers WHERE user_id = ?', [cur.user_id]);
        let deleted = 0;
        for (const s of servers) if (await destroyServer(s, now)) deleted += 1;
        if (deleted === servers.length) await q('UPDATE monthly_invoices SET services_deleted_at = ? WHERE id = ?', [now, cur.id]);
        if (deleted) {
            await email(cur.user_id, 'Your servers have been deleted', [
                `Invoice ${label} was not paid within ${DELETE_AFTER_HOURS / 24} days, so your ${deleted === 1 ? 'server and its data have' : `${deleted} servers and their data have`} been deleted.`,
                'The invoice is still due. Please pay it to keep using Walras Cloud.',
            ], 'Pay your invoice');
        }
    }
});

let running = false;

/**
 * One pass (every 15 minutes, and on the 1st at 00:00 IST): end cancelled
 * plans, issue last month's invoices if not yet issued, pay what balances
 * allow, then apply the overdue timeline.
 */
const run = async (now = new Date()) => {
    if (running) return;
    running = true;
    try {
        await processCancellations(now);
        await q(
            `INSERT INTO service_usage (user_id, kind, ref_id, label, plan_name, monthly_price, started_at)
             SELECT s.user_id, 'vm', s.id, CONCAT('Virtual Machine ', COALESCE(s.hostname, s.name), ' (', s.plan_name, ')'), s.plan_name,
                    ROUND(COALESCE(s.monthly_cost, 0) * 100), COALESCE(s.created_at, NOW())
               FROM servers s
              WHERE s.status <> 'failed' AND s.solus_server_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM service_usage u WHERE u.kind = 'vm' AND u.ref_id = s.id)
             RETURNING id`,
        ).then((r) => { if (rowsOf(r).length) console.warn(`[Billing] Added ${rowsOf(r).length} missing usage record(s)`); });
        const { y, m } = previousMonth(now);
        await generateForMonth(y, m, now);

        const withBalance = await q(
            `SELECT DISTINCT i.user_id FROM monthly_invoices i JOIN wallets w ON w.user_id = i.user_id
              WHERE i.status <> 'paid' AND i.total_amount > i.amount_paid AND i.subtotal IS NOT NULL AND w.balance > 0`,
        );
        for (const { user_id: userId } of withBalance) await applyBalance(userId).catch((e) => console.error('[Billing] Balance payment failed:', e.message));

        const unpaid = await q(
            "SELECT id, user_id FROM monthly_invoices WHERE status <> 'paid' AND total_amount > amount_paid AND subtotal IS NOT NULL AND generated_at <= ?",
            [new Date(now.getTime() - PAY_WITHIN_HOURS * 3600 * 1000)],
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

/** This month so far, excluding GST: the "unbilled amount". */
const estimate = async (userId, now = new Date()) => {
    const { y, m } = istParts(now);
    const usages = await q(
        'SELECT * FROM service_usage WHERE user_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at > ?)',
        [userId, now, monthStart(y, m)],
    );
    return buildInvoice(usages, null, y, m, now).subtotal;
};

/** Deadlines of an invoice, for display. */
const deadlines = (inv) => {
    const t = new Date(inv.generated_at).getTime();
    const at = (h) => new Date(t + h * 3600 * 1000);
    return { payBy: at(PAY_WITHIN_HOURS), suspendAt: at(SUSPEND_AFTER_HOURS), deleteAt: at(DELETE_AFTER_HOURS) };
};

const publicInvoice = (inv) => ({
    id: inv.id,
    number: inv.invoice_number,
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
    ...(inv.subtotal === null ? {} : deadlines(inv)),
});

module.exports = {
    PAY_WITHIN_HOURS, LATE_FEE_RATE, SUSPEND_AFTER_HOURS, DELETE_AFTER_HOURS,
    // dates
    istParts, monthStart, daysInMonth, previousMonth, nextMonthStart, lineFor,
    // usage and servers
    startUsage, endUsage, discardUsage, destroyServer, isSuspended, hasOverdue, resumeIfClear,
    // invoices
    generateForMonth, applyBalance, payFromBalance, run, processCancellations, scheduleCancel, undoCancel,
    waiveLateFee, markPaid, estimate, publicInvoice, withUserLock,
};
