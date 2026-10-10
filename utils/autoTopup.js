/**
 * Auto top-up: when an account's balance falls to its threshold, Walras
 * charges the customer's saved card (a Razorpay recurring token,
 * services/razorpay.js) to bring the balance back up to their target.
 *
 *   1. Setup: the customer picks "when balance reaches ₹X, top up to ₹Y" and
 *      pays once through Razorpay Checkout with recurring on, which saves the
 *      card as a token (approved with OTP). That first payment is a normal
 *      top-up. The token can be charged once Razorpay reports it "confirmed";
 *      run() checks tokens still being confirmed.
 *   2. Trigger (run(), every 15 minutes): balance ≤ X and no charge already
 *      open → a charge for Y − balance is requested from Razorpay. Razorpay
 *      sends the RBI pre-debit notification and debits about 36 hours later;
 *      we also email the customer. One open charge per account (unique index).
 *   3. Razorpay reports the result (webhook, or utils/payments.js reconcile):
 *      success credits the wallet through the same exactly-once path as other
 *      payments; a failure is counted.
 *   4. Guards: at most MAX_CHARGES_PER_DAY charges a day; after MAX_FAILURES
 *      failures in a row auto top-up switches itself off and the customer is
 *      emailed; nothing runs while top-ups are paused, during maintenance,
 *      while the admin switch is off, or before Razorpay has enabled
 *      recurring payments on the account (RAZORPAY_RECURRING=enabled).
 *
 * Amounts are in paise.
 */
const connection = require('../config/db');
const razorpay = require('../services/razorpay');
const payments = require('./payments');
const { ensureWallet } = require('./wallets');
const { sendRawEmail, escapeHtml } = require('./sendEmail');
const integrations = require('./integrations');
const { getPlatform } = require('./platformSettings');

const MIN_THRESHOLD = 100 * 100;
const MIN_GAP = 100 * 100; // target must be at least this much above the threshold
const MAX_TARGET = razorpay.MAX_DEBIT_PAISE;
const MAX_CHARGES_PER_DAY = 3;
const MAX_FAILURES = 2;
const RETRY_AFTER_FAILURE_HOURS = 6; // pause before charging again after a failed charge
const TOKEN_YEARS = 10; // how long a saved card stays authorised for auto top-up

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
        // 'pending': a card is saved and Razorpay hasn't confirmed it yet (not just a setup started).
        mandate: row?.si_status === 'active' ? 'active' : row?.si_status === 'pending' && row?.si_ref ? 'pending' : 'none',
        paymentMethod: row?.si_status === 'active' ? row.si_card_label : null,
        lastError: row?.last_error || null,
        upcoming: open[0] ? { amount: Number(open[0].amount) / 100, status: open[0].status, dueAt: open[0].due_at } : null,
        recent: recent.map((c) => ({ amount: Number(c.amount) / 100, status: c.status, error: c.error, at: c.created_at })),
        limits: {
            minThreshold: MIN_THRESHOLD / 100,
            minGap: MIN_GAP / 100,
            maxTarget: MAX_TARGET / 100,
            maxPerDay: MAX_CHARGES_PER_DAY,
            noticeHours: razorpay.DEBIT_DELAY_HOURS,
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
 * Change the amounts or switch it on/off. Switching on needs a confirmed
 * saved card (setup); without one, use startSetup.
 */
const update = async (userId, body) => {
    const row = await getRow(userId);
    if (!row || row.si_status !== 'active') throw new AutoTopupError(409, 'Set up auto top-up first: it needs one payment to save your card for automatic charges.');
    const amounts = readAmounts({ threshold: body.threshold ?? Number(row.threshold) / 100, target: body.target ?? Number(row.target) / 100 });
    const enabled = body.enabled === undefined ? row.enabled : Boolean(body.enabled);
    await q(
        `UPDATE wallet_auto_topup SET threshold = ?, target = ?, enabled = ?, failures = CASE WHEN ? THEN 0 ELSE failures END,
            last_error = CASE WHEN ? THEN NULL ELSE last_error END, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [amounts.threshold, amounts.target, enabled, enabled && !row.enabled, enabled && !row.enabled, userId],
    );
    return view(userId);
};

/**
 * Starts setup: a Razorpay Checkout payment that tops up the balance to the
 * target (at least ₹1) and saves the card for recurring charges. Returns the
 * options the browser opens Checkout with.
 */
const startSetup = async (userId, body) => {
    if (!(await platformOpen())) throw new AutoTopupError(409, 'Auto top-up is not available right now.');
    const amounts = readAmounts(body);
    const [user] = await q('SELECT name, email, phone FROM users WHERE id = ?', [userId]);
    const wallet = await walletOf(userId);
    const amount = Math.max(100, amounts.target - wallet.balance);
    const customerId = await razorpay.ensureCustomer({ name: user?.name, email: user?.email, contact: user?.phone });

    const checkout = await payments.startCheckout({
        userId,
        purpose: 'autotopup_setup',
        amount,
        description: 'Auto top-up setup payment',
        customerId,
        recurringToken: { maxAmount: MAX_TARGET, expireAt: Math.floor(Date.now() / 1000) + TOKEN_YEARS * 365 * 24 * 3600 },
    });
    await q(
        `INSERT INTO wallet_auto_topup (user_id, enabled, threshold, target, si_status, setup_order_id, customer_ref)
         VALUES (?, FALSE, ?, ?, 'pending', ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET threshold = EXCLUDED.threshold, target = EXCLUDED.target,
            si_status = CASE WHEN wallet_auto_topup.si_status = 'active' THEN 'active' ELSE 'pending' END,
            setup_order_id = EXCLUDED.setup_order_id, customer_ref = EXCLUDED.customer_ref, updated_at = CURRENT_TIMESTAMP
         RETURNING user_id`, // explicit: pgCompat would otherwise add RETURNING id, and this table has none
        [userId, amounts.threshold, amounts.target, checkout.orderId, customerId],
    );
    return { checkout };
};

/**
 * The setup payment was captured (utils/payments.js, after crediting it):
 * keep its card token. Charges wait until Razorpay confirms the token.
 */
const setupCaptured = async (order, payment) => {
    const [row] = await q('SELECT * FROM wallet_auto_topup WHERE setup_order_id = ?', [order.order_id]);
    if (!row) return;
    const full = payment?.id ? await razorpay.fetchPayment(payment.id) : null;
    const tokenId = full?.token_id || payment?.token_id;
    if (!tokenId) {
        await q("UPDATE wallet_auto_topup SET si_status = CASE WHEN si_status = 'active' THEN 'active' ELSE 'none' END, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            ['Payment received, but the card was not saved for automatic payments.', row.user_id]);
        return;
    }
    await q(
        `UPDATE wallet_auto_topup SET si_status = 'pending', si_ref = ?, si_card_label = ?, failures = 0, last_error = NULL,
            updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [tokenId, razorpay.cardLabel(full).slice(0, 100), row.user_id],
    );
    await confirmToken({ ...row, si_ref: tokenId }).catch((e) => console.error('[AutoTopup] Token check failed:', e.message));
};

/** A saved card waiting for Razorpay's confirmation: switch on once confirmed. */
const confirmToken = async (row) => {
    if (!row.si_ref || !row.customer_ref) return;
    const { status, reason } = await razorpay.tokenStatus(row.customer_ref, row.si_ref);
    if (status === 'confirmed') {
        await q("UPDATE wallet_auto_topup SET si_status = 'active', enabled = TRUE, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND si_status = 'pending'", [row.user_id]);
    } else if (['rejected', 'cancelled'].includes(status)) {
        await q("UPDATE wallet_auto_topup SET si_status = 'none', enabled = FALSE, si_ref = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            [`Your bank didn't approve automatic payments${reason ? ` (${reason})` : ''}.`.slice(0, 255), row.user_id]);
    }
};

/** Switch off and remove the saved card at Razorpay. */
const cancel = async (userId) => {
    const row = await getRow(userId);
    if (!row) return view(userId);
    if (row.si_ref && row.customer_ref) {
        try {
            await razorpay.deleteToken(row.customer_ref, row.si_ref);
        } catch (err) {
            // Ours is switched off regardless; nothing will be charged.
            console.error(`[AutoTopup] Deleting the saved card for user ${userId} failed:`, err.message);
        }
    }
    await q(
        `UPDATE wallet_auto_topup SET enabled = FALSE, si_status = 'cancelled', si_ref = NULL, si_card_label = NULL,
            updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [userId],
    );
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

// ── Charges ──────────────────────────────────────────────────────────────

const recordFailure = async (userId, message) => {
    const [row] = await q(
        `UPDATE wallet_auto_topup SET failures = failures + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? RETURNING failures`,
        [String(message).slice(0, 255), userId],
    ).then((r) => r.rows || []);
    if (row && row.failures >= MAX_FAILURES) {
        await q('UPDATE wallet_auto_topup SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [userId]);
        await email(userId, 'Auto top-up has been switched off', [
            `We couldn't charge your saved card for an automatic top-up (${message}), so auto top-up is now off.`,
            'Your servers keep running while your balance lasts. Add funds or switch auto top-up back on from the Billing page.',
        ]);
    } else {
        await email(userId, 'An automatic top-up failed', [
            `We couldn't charge your saved card for an automatic top-up: ${message}.`,
            'We will try again the next time your balance reaches your threshold. You can also add funds yourself from the Billing page.',
        ]);
    }
};

/** Request a charge for one account that needs one. */
const charge = async (row, wallet) => {
    const [{ n }] = await q(
        "SELECT COUNT(*)::int AS n FROM wallet_auto_topup_charges WHERE user_id = ? AND status IN ('scheduled', 'pending', 'success') AND created_at > NOW() - INTERVAL '1 day'",
        [row.user_id],
    );
    if (n >= MAX_CHARGES_PER_DAY) return;
    const amount = Math.min(Number(row.target) - wallet.balance, MAX_TARGET);
    if (amount < 100) return;

    // Claim the account's one open charge first (unique index), then ask Razorpay.
    const placeholder = `pending_${row.user_id}_${Date.now()}`;
    const dueAt = new Date(Date.now() + razorpay.DEBIT_DELAY_HOURS * 3600 * 1000);
    try {
        await q("INSERT INTO wallet_auto_topup_charges (user_id, order_id, amount, status, due_at) VALUES (?, ?, ?, 'pending', ?)",
            [row.user_id, placeholder, amount, dueAt]);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return; // another run got there first
        throw err;
    }

    const [user] = await q('SELECT name, email, phone FROM users WHERE id = ?', [row.user_id]);
    let result;
    try {
        result = await razorpay.chargeToken({
            customerId: row.customer_ref,
            tokenId: row.si_ref,
            amount,
            receipt: `autotopup_${row.user_id}_${Date.now()}`,
            notes: { purpose: 'autotopup_charge', user_id: String(row.user_id) },
            email: user?.email,
            contact: user?.phone,
            description: 'Walras Cloud auto top-up',
        });
    } catch (err) {
        await q("UPDATE wallet_auto_topup_charges SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
            [String(err.message).slice(0, 255), placeholder]);
        await recordFailure(row.user_id, err.message);
        return;
    }

    // The charge is now a Razorpay order like any other (utils/payments.js settles it).
    await q('INSERT INTO payment_orders (order_id, user_id, purpose, amount, payment_id) VALUES (?, ?, ?, ?, ?) RETURNING order_id',
        [result.orderId, row.user_id, 'autotopup_charge', amount, result.paymentId]);
    await q(
        `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, razorpay_order_id, razorpay_payment_id, status)
         VALUES (?, 'credit', ?, ?, ?, ?, ?, 'pending')`,
        [wallet.id, amount, `Auto top-up (Razorpay order ${result.orderId})`, result.orderId, result.orderId, result.paymentId],
    );
    await q('UPDATE wallet_auto_topup_charges SET order_id = ?, tracking_id = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?',
        [result.orderId, result.paymentId, placeholder]);

    const when = dueAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    await email(row.user_id, `Upcoming automatic top-up of ${rupees(amount)}`, [
        `Your account balance has reached ${rupees(wallet.balance)}, at or below your auto top-up threshold of ${rupees(row.threshold)}.`,
        `We've asked for ${rupees(amount)} to be charged to ${row.si_card_label || 'your saved card'} to bring it back to ${rupees(row.target)}. Your bank will notify you first and the charge is made around ${when} (IST).`,
        'The amount is added to your account balance once the charge goes through.',
    ]);
};

payments.hooks.setupCaptured = setupCaptured;

payments.hooks.chargeCaptured = async (order) => {
    await q("UPDATE wallet_auto_topup_charges SET status = 'success', updated_at = CURRENT_TIMESTAMP WHERE order_id = ?", [order.order_id]);
    await q('UPDATE wallet_auto_topup SET failures = 0, last_error = NULL WHERE user_id = ?', [order.user_id]);
    console.log(`[AutoTopup] Charged ${rupees(order.amount)} for user ${order.user_id} (${order.order_id})`);
};

payments.hooks.chargeFailed = async (order, reason) => {
    await q("UPDATE wallet_auto_topup_charges SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?",
        [String(reason).slice(0, 255), order.order_id]);
    await recordFailure(order.user_id, reason);
};

let running = false;

/** One pass: confirm saved cards, then charge accounts that need it. */
const run = async () => {
    if (running) return;
    running = true;
    try {
        if (!(await platformOpen())) return;

        for (const row of await q("SELECT * FROM wallet_auto_topup WHERE si_status = 'pending' AND si_ref IS NOT NULL")) {
            await confirmToken(row).catch((e) => console.error(`[AutoTopup] Token check for user ${row.user_id} failed:`, e.message));
        }

        const due = await q(
            `SELECT a.*, w.balance FROM wallet_auto_topup a JOIN wallets w ON w.user_id = a.user_id
              WHERE a.enabled AND a.si_status = 'active' AND a.si_ref IS NOT NULL AND a.customer_ref IS NOT NULL AND w.balance <= a.threshold
                AND NOT EXISTS (SELECT 1 FROM wallet_auto_topup_charges c WHERE c.user_id = a.user_id AND c.status IN ('scheduled', 'pending'))
                AND NOT EXISTS (SELECT 1 FROM wallet_auto_topup_charges c WHERE c.user_id = a.user_id AND c.status = 'failed'
                                 AND c.updated_at > NOW() - INTERVAL '${RETRY_AFTER_FAILURE_HOURS} hours')`,
        );
        for (const row of due) {
            try {
                const wallet = await walletOf(row.user_id);
                await charge(row, wallet);
            } catch (err) {
                console.error(`[AutoTopup] Charging user ${row.user_id} failed:`, err.message);
            }
        }
    } catch (err) {
        console.error('[AutoTopup] Run failed:', err.message);
    } finally {
        running = false;
    }
};

module.exports = { view, update, startSetup, cancel, run, readAmounts, AutoTopupError, MAX_FAILURES, MAX_CHARGES_PER_DAY };
