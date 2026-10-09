/**
 * Auto top-up: when an account's balance falls to its threshold, Walras
 * charges the customer's CCAvenue standing instruction (services/ccavenueSI.js)
 * to bring the balance back up to their target.
 *
 *   1. Setup: the customer picks "when balance reaches ₹X, top up to ₹Y" and
 *      pays once through the normal CCAvenue checkout, which also registers
 *      an on-demand standing instruction (approved with OTP). That first
 *      payment is a normal top-up.
 *   2. Trigger (run(), after each hourly billing run and every 15 minutes):
 *      balance ≤ X and nothing already open → a charge is *scheduled* for
 *      Y − balance and the customer is told it's coming (RBI pre-debit
 *      notice). One open charge per account (unique index).
 *   3. When it's due: if the balance is still at or below X, the charge is
 *      sent; otherwise it's cancelled. Success credits the wallet through
 *      the same exactly-once path as other top-ups (utils/walletCredit.js).
 *   4. Guards: at most MAX_CHARGES_PER_DAY charges a day; after MAX_FAILURES
 *      failures in a row auto top-up switches itself off and the customer
 *      is emailed; nothing runs while top-ups are paused, during
 *      maintenance, or while the admin switch is off.
 *
 * Amounts are in paise.
 */
const connection = require('../config/db');
const ccavenue = require('../services/ccavenueService');
const si = require('../services/ccavenueSI');
const { creditPendingTopup, failPendingTopup } = require('./walletCredit');
const { ensureWallet } = require('./wallets');
const { sendRawEmail, escapeHtml } = require('./sendEmail');
const integrations = require('./integrations');
const { getPlatform } = require('./platformSettings');

const MIN_THRESHOLD = 100 * 100;
const MIN_GAP = 100 * 100; // target must be at least this much above the threshold
const MAX_TARGET = si.MAX_DEBIT_PAISE;
const MAX_CHARGES_PER_DAY = 3;
const MAX_FAILURES = 2;
const RETRY_AFTER_FAILURE_HOURS = 6; // pause before scheduling again after a failed charge

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const rupees = (paise) => `₹${(Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

class AutoTopupError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/** Is auto top-up available on the platform right now? */
const platformOpen = async () => {
    const p = await getPlatform();
    return p.autoTopupEnabled && p.autoTopupReady && !p.topUpsPaused && !p.maintenanceMode;
};

const getRow = async (userId) => (await q('SELECT * FROM wallet_auto_topup WHERE user_id = ?', [userId]))[0] || null;

const walletOf = async (userId) => {
    const wallet = await ensureWallet(userId);
    return { id: wallet.id, balance: Number(wallet.balance) };
};

/** What the customer sees on the Billing page. */
const view = async (userId) => {
    const [row, open, recent, available] = await Promise.all([
        getRow(userId),
        q("SELECT amount, status, due_at FROM wallet_auto_topup_charges WHERE user_id = ? AND status IN ('scheduled', 'pending')", [userId]),
        q('SELECT amount, status, error, created_at FROM wallet_auto_topup_charges WHERE user_id = ? ORDER BY id DESC LIMIT 5', [userId]),
        platformOpen().catch(() => false),
    ]);
    return {
        available,
        enabled: Boolean(row?.enabled) && row?.si_status === 'active',
        threshold: row ? Number(row.threshold) / 100 : 500,
        target: row ? Number(row.target) / 100 : 2000,
        mandate: row?.si_status === 'active' ? 'active' : row?.si_status === 'pending' ? 'pending' : 'none',
        paymentMethod: row?.si_status === 'active' ? row.si_card_label : null,
        lastError: row?.last_error || null,
        upcoming: open[0] ? { amount: Number(open[0].amount) / 100, status: open[0].status, dueAt: open[0].due_at } : null,
        recent: recent.map((c) => ({ amount: Number(c.amount) / 100, status: c.status, error: c.error, at: c.created_at })),
        limits: {
            minThreshold: MIN_THRESHOLD / 100,
            minGap: MIN_GAP / 100,
            maxTarget: MAX_TARGET / 100,
            maxPerDay: MAX_CHARGES_PER_DAY,
            noticeHours: si.PRE_DEBIT_HOURS,
        },
    };
};

/** Validated { threshold, target } in paise from rupee inputs. */
const readAmounts = ({ threshold, target }) => {
    const t = Math.round(Number(threshold) * 100);
    const g = Math.round(Number(target) * 100);
    if (!Number.isFinite(t) || t < MIN_THRESHOLD) throw new AutoTopupError(400, `"When balance reaches" must be at least ${rupees(MIN_THRESHOLD)}.`);
    if (!Number.isFinite(g) || g > MAX_TARGET) throw new AutoTopupError(400, `"Top up to" can be at most ${rupees(MAX_TARGET)}.`);
    if (g - t < MIN_GAP) throw new AutoTopupError(400, `"Top up to" must be at least ${rupees(MIN_GAP)} more than "When balance reaches".`);
    return { threshold: t, target: g };
};

/**
 * Change the amounts or switch it on/off. Switching on needs an approved
 * standing instruction (setup); without one, use startSetup.
 */
const update = async (userId, body) => {
    const row = await getRow(userId);
    if (!row || row.si_status !== 'active') throw new AutoTopupError(409, 'Set up auto top-up first: it needs one payment to approve automatic charges.');
    const amounts = readAmounts({ threshold: body.threshold ?? Number(row.threshold) / 100, target: body.target ?? Number(row.target) / 100 });
    const enabled = body.enabled === undefined ? row.enabled : Boolean(body.enabled);
    await q(
        `UPDATE wallet_auto_topup SET threshold = ?, target = ?, enabled = ?, failures = CASE WHEN ? THEN 0 ELSE failures END,
            last_error = CASE WHEN ? THEN NULL ELSE last_error END, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [amounts.threshold, amounts.target, enabled, enabled && !row.enabled, enabled && !row.enabled, userId],
    );
    // Turned off: drop a charge that hasn't been sent yet.
    if (!enabled) await q("UPDATE wallet_auto_topup_charges SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'scheduled'", [userId]);
    return view(userId);
};

/**
 * Starts setup: a CCAvenue checkout that tops up the balance to the target
 * (at least ₹1) and registers the standing instruction. Returns the form
 * fields the browser posts to CCAvenue, like a normal top-up.
 */
const startSetup = async (userId, body) => {
    if (!(await platformOpen())) throw new AutoTopupError(409, 'Auto top-up is not available right now.');
    const config = ccavenue.getConfig();
    if (!config.isConfigured) throw new AutoTopupError(503, 'Payments are not available right now.');
    const amounts = readAmounts(body);
    const [user] = await q('SELECT name, email, phone FROM users WHERE id = ?', [userId]);
    const wallet = await walletOf(userId);
    const amount = Math.max(100, amounts.target - wallet.balance);
    const orderId = `CCAS_${Date.now()}_${userId}`;

    await q(
        `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
         VALUES (?, 'credit', ?, ?, ?, 'pending')`,
        [wallet.id, amount, `Auto top-up setup payment (Order ${orderId})`, orderId],
    );
    await q(
        `INSERT INTO wallet_auto_topup (user_id, enabled, threshold, target, si_status, setup_order_id)
         VALUES (?, FALSE, ?, ?, 'pending', ?)
         ON CONFLICT (user_id) DO UPDATE SET threshold = EXCLUDED.threshold, target = EXCLUDED.target,
            si_status = CASE WHEN wallet_auto_topup.si_status = 'active' THEN 'active' ELSE 'pending' END,
            setup_order_id = EXCLUDED.setup_order_id, updated_at = CURRENT_TIMESTAMP
         RETURNING user_id`, // explicit: pgCompat would otherwise add RETURNING id, and this table has none
        [userId, amounts.threshold, amounts.target, orderId],
    );

    const params = {
        merchant_id: config.merchantId,
        order_id: orderId,
        currency: 'INR',
        amount: (amount / 100).toFixed(2),
        redirect_url: `${config.clientUrl}/api/payment/ccavenue/response`,
        cancel_url: `${config.clientUrl}/api/payment/ccavenue/cancel`,
        language: 'EN',
        billing_name: user?.name || 'Customer',
        billing_email: user?.email || '',
        billing_tel: user?.phone || '',
        merchant_param1: String(userId),
        merchant_param2: 'autotopup_setup',
        ...si.registrationFields({ refNo: orderId, maxDebitPaise: amounts.target }),
    };
    return {
        actionUrl: config.actionUrl,
        encRequest: ccavenue.encrypt(ccavenue.stringifyParams(params), config.workingKey),
        accessCode: config.accessCode,
        amount: (amount / 100).toFixed(2),
    };
};

/**
 * CCAvenue's checkout response for a setup order (CCAS_…): credits the
 * payment and, if the standing instruction was approved, switches auto
 * top-up on. Returns { ok, message } for the redirect back to Billing.
 */
const completeSetup = async (data) => {
    const orderId = data.order_id;
    const [row] = await q('SELECT * FROM wallet_auto_topup WHERE setup_order_id = ?', [orderId]);
    const paid = String(data.order_status || '').toLowerCase() === 'success';
    const ref = data.tracking_id || data.bank_ref_no || orderId;

    if (!paid) {
        await failPendingTopup(orderId, `CCAvenue Failed: ${data.failure_message || data.order_status || 'Payment failed'}`);
        if (row && row.si_status === 'pending') {
            await q("UPDATE wallet_auto_topup SET si_status = 'none', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                ['The setup payment did not go through.', row.user_id]);
        }
        return { ok: false, message: data.failure_message || 'Payment failed' };
    }

    await creditPendingTopup(orderId, { description: `Auto top-up setup payment (Ref: ${ref})`, paymentRef: ref });
    if (!row) return { ok: false, message: 'Payment received, but the auto top-up setup was not found.' };

    const reg = si.readRegistration(data);
    if (!reg.ok) {
        await q("UPDATE wallet_auto_topup SET si_status = CASE WHEN si_status = 'active' THEN 'active' ELSE 'none' END, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            [reg.error.slice(0, 255), row.user_id]);
        return { ok: false, message: `Payment received, but automatic payments weren't approved: ${reg.error}` };
    }
    await q(
        `UPDATE wallet_auto_topup SET si_status = 'active', si_ref = ?, si_card_label = ?, enabled = TRUE, failures = 0,
            last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [reg.ref, reg.cardLabel.slice(0, 100), row.user_id],
    );
    return { ok: true, message: 'Auto top-up is on.' };
};

/** Switch off and cancel the standing instruction at CCAvenue. */
const cancel = async (userId) => {
    const row = await getRow(userId);
    if (!row) return view(userId);
    if (row.si_ref && row.si_status === 'active') {
        try {
            await si.cancel(row.si_ref);
        } catch (err) {
            // Ours is switched off regardless; nothing will be charged.
            console.error(`[AutoTopup] Cancelling the standing instruction for user ${userId} failed:`, err.message);
        }
    }
    await q(
        `UPDATE wallet_auto_topup SET enabled = FALSE, si_status = 'cancelled', si_ref = NULL, si_card_label = NULL,
            updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [userId],
    );
    await q("UPDATE wallet_auto_topup_charges SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status = 'scheduled'", [userId]);
    return view(userId);
};

// ── Emails ───────────────────────────────────────────────────────────────

const billingUrl = () => `${(integrations.get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '')}/dashboard/billing`;

const email = async (userId, subject, lines) => {
    try {
        const [user] = await q('SELECT name, email FROM users WHERE id = ?', [userId]);
        if (!user?.email) return;
        const text = [`Hi ${user.name || 'there'},`, '', ...lines, '', `Manage auto top-up: ${billingUrl()}`, '', 'Walras Cloud'].join('\n');
        const html = `<p>Hi ${escapeHtml(user.name || 'there')},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`
            + `<p><a href="${escapeHtml(billingUrl())}">Manage auto top-up</a></p><p>Walras Cloud</p>`;
        await sendRawEmail({ to: user.email, subject, text, html });
    } catch (err) {
        console.error(`[AutoTopup] Email to user ${userId} failed:`, err.message);
    }
};

// ── The run ──────────────────────────────────────────────────────────────

const recordFailure = async (userId, message) => {
    const [row] = await q(
        `UPDATE wallet_auto_topup SET failures = failures + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? RETURNING failures`,
        [String(message).slice(0, 255), userId],
    ).then((r) => r.rows || []);
    if (row && row.failures >= MAX_FAILURES) {
        await q('UPDATE wallet_auto_topup SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
        await email(userId, 'Auto top-up has been switched off', [
            `We couldn't charge your saved payment method for an automatic top-up (${message}), so auto top-up is now off.`,
            'Your servers keep running while your balance lasts. Add funds or switch auto top-up back on from the Billing page.',
        ]);
    } else {
        await email(userId, 'An automatic top-up failed', [
            `We couldn't charge your saved payment method for an automatic top-up: ${message}.`,
            'We will try again the next time your balance reaches your threshold. You can also add funds yourself from the Billing page.',
        ]);
    }
};

/** Schedule a charge for one account if it needs one. */
const schedule = async (row, wallet) => {
    const [{ n }] = await q(
        "SELECT COUNT(*)::int AS n FROM wallet_auto_topup_charges WHERE user_id = ? AND status IN ('scheduled', 'pending', 'success') AND created_at > NOW() - INTERVAL '1 day'",
        [row.user_id],
    );
    if (n >= MAX_CHARGES_PER_DAY) return;
    const amount = Math.min(Number(row.target) - wallet.balance, si.MAX_DEBIT_PAISE);
    if (amount < 100) return;
    const orderId = `CCAT_${Date.now()}_${row.user_id}`;
    const dueAt = new Date(Date.now() + si.PRE_DEBIT_HOURS * 3600 * 1000);
    try {
        await q(
            "INSERT INTO wallet_auto_topup_charges (user_id, order_id, amount, status, due_at) VALUES (?, ?, ?, 'scheduled', ?)",
            [row.user_id, orderId, amount, dueAt],
        );
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return; // another run scheduled one first
        throw err;
    }
    try {
        await si.sendPreDebitNotice({ siRef: row.si_ref, amountPaise: amount, orderId, debitDate: dueAt });
    } catch (err) {
        await q("UPDATE wallet_auto_topup_charges SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
            [`Pre-debit notice failed: ${err.message}`.slice(0, 255), orderId]);
        await recordFailure(row.user_id, 'the payment notice could not be sent');
        return;
    }
    const when = dueAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    await email(row.user_id, `Upcoming automatic top-up of ${rupees(amount)}`, [
        `Your account balance has reached ${rupees(wallet.balance)}, at or below your auto top-up threshold of ${rupees(row.threshold)}.`,
        `We will charge ${rupees(amount)} to ${row.si_card_label || 'your saved payment method'} on ${when} (IST) to bring it back to ${rupees(row.target)}.`,
        "If you add funds before then and your balance is above the threshold, we won't charge you.",
    ]);
};

/** A charge whose notice period is over: send it, or cancel if no longer needed. */
const sendDue = async (charge) => {
    const [claimed] = await q(
        "UPDATE wallet_auto_topup_charges SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled' RETURNING id",
        [charge.id],
    ).then((r) => r.rows || []);
    if (!claimed) return; // another run took it

    const row = await getRow(charge.user_id);
    const wallet = await walletOf(charge.user_id);
    if (!row?.enabled || row.si_status !== 'active' || wallet.balance > Number(row.threshold)) {
        await q("UPDATE wallet_auto_topup_charges SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [charge.id]);
        return;
    }
    // Never more than the customer was told; less if they added funds since.
    const amount = Math.min(Number(charge.amount), Number(row.target) - wallet.balance);
    if (amount < 100) {
        await q("UPDATE wallet_auto_topup_charges SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [charge.id]);
        return;
    }
    await q('UPDATE wallet_auto_topup_charges SET amount = ? WHERE id = ?', [amount, charge.id]);
    await q(
        `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
         VALUES (?, 'credit', ?, ?, ?, 'pending')`,
        [wallet.id, amount, `Auto top-up (Order ${charge.order_id})`, charge.order_id],
    );

    let result;
    try {
        result = await si.charge({ siRef: row.si_ref, amountPaise: amount, orderId: charge.order_id });
    } catch (err) {
        result = { status: 'failed', error: err.message };
    }
    await settle(charge, result, amount);
};

/** Apply a charge result: credit on success, count a failure, or leave pending. */
const settle = async (charge, result, amount = Number(charge.amount)) => {
    if (result.status === 'pending') return;
    if (result.status === 'success') {
        const ref = result.trackingId || charge.order_id;
        await creditPendingTopup(charge.order_id, { description: `Auto top-up (Ref: ${ref})`, paymentRef: ref });
        // Pay any unpaid invoice with it now (required here: monthlyBilling doesn't load this module).
        await require('./monthlyBilling').applyBalance(charge.user_id).catch((e) => console.error('[AutoTopup] Paying invoices failed:', e.message));
        await q("UPDATE wallet_auto_topup_charges SET status = 'success', tracking_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [result.trackingId, charge.id]);
        await q('UPDATE wallet_auto_topup SET failures = 0, last_error = NULL WHERE user_id = ?', [charge.user_id]);
        console.log(`[AutoTopup] Charged ${rupees(amount)} for user ${charge.user_id} (${charge.order_id})`);
        return;
    }
    const message = result.error || 'Payment declined';
    await failPendingTopup(charge.order_id, `Auto top-up failed: ${message}`);
    await q("UPDATE wallet_auto_topup_charges SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [message.slice(0, 255), charge.id]);
    await recordFailure(charge.user_id, message);
};

let running = false;

/** One pass: settle pending charges, send due ones, schedule new ones. */
const run = async () => {
    if (running) return;
    running = true;
    try {
        if (!(await platformOpen())) return;

        for (const charge of await q("SELECT * FROM wallet_auto_topup_charges WHERE status = 'pending' AND updated_at < NOW() - INTERVAL '10 minutes'")) {
            try {
                await settle(charge, await si.chargeStatus(charge.order_id));
            } catch (err) {
                console.error(`[AutoTopup] Status check for ${charge.order_id} failed:`, err.message);
            }
        }

        for (const charge of await q("SELECT * FROM wallet_auto_topup_charges WHERE status = 'scheduled' AND due_at <= NOW()")) {
            try {
                await sendDue(charge);
            } catch (err) {
                console.error(`[AutoTopup] Charge ${charge.order_id} failed:`, err.message);
            }
        }

        const due = await q(
            `SELECT a.*, w.balance FROM wallet_auto_topup a JOIN wallets w ON w.user_id = a.user_id
              WHERE a.enabled AND a.si_status = 'active' AND w.balance <= a.threshold
                AND NOT EXISTS (SELECT 1 FROM wallet_auto_topup_charges c WHERE c.user_id = a.user_id AND c.status IN ('scheduled', 'pending'))
                AND NOT EXISTS (SELECT 1 FROM wallet_auto_topup_charges c WHERE c.user_id = a.user_id AND c.status = 'failed'
                                 AND c.updated_at > NOW() - INTERVAL '${RETRY_AFTER_FAILURE_HOURS} hours')`,
        );
        for (const row of due) {
            try {
                await schedule(row, { balance: Number(row.balance) });
            } catch (err) {
                console.error(`[AutoTopup] Scheduling for user ${row.user_id} failed:`, err.message);
            }
        }
    } catch (err) {
        console.error('[AutoTopup] Run failed:', err.message);
    } finally {
        running = false;
    }
};

module.exports = { view, update, startSetup, completeSetup, cancel, run, readAmounts, AutoTopupError, MAX_FAILURES, MAX_CHARGES_PER_DAY };
