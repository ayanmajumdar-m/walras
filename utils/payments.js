/**
 * Money in through Razorpay (services/razorpay.js), in one place.
 *
 * Every Razorpay order we create is recorded in payment_orders with what it
 * is for (purpose) and a pending wallet_transactions row (reference_id = the
 * order id). When the payment is captured, from whichever reports it first
 * (Checkout's verify call, the webhook, or reconcile()), handleCaptured
 * credits the account balance exactly once and then does what the purpose
 * needs:
 *   topup             nothing more (and unpaid invoices are paid from it)
 *   invoice           pay that invoice first from the balance
 *   autotopup_setup   save the card token for auto top-up
 *   autotopup_charge  close the auto top-up charge
 * Checkout lets a customer retry a failed attempt on the same order, so a
 * failed attempt never fails the order; only a server-initiated auto top-up
 * charge fails on payment.failed.
 */
const connection = require('../config/db');
const razorpay = require('../services/razorpay');
const { creditPendingTopup, creditExpiredTopup, failPendingTopup } = require('./walletCredit');

// An unpaid checkout's pending transaction is removed this long after it started.
const PENDING_TTL_HOURS = 3;
const { ensureWallet } = require('./wallets');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const PURPOSES = {
    topup: 'Account balance top-up',
    invoice: 'Invoice payment',
    autotopup_setup: 'Auto top-up setup',
    autotopup_charge: 'Auto top-up',
};

class PaymentError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * Creates the Razorpay order, our record of it and the pending balance
 * credit. Returns what Razorpay Checkout needs in the browser.
 */
const startCheckout = async ({ userId, purpose, amount, invoiceId = null, description, customerId = null, recurringToken = null }) => {
    if (!razorpay.isConfigured()) throw new PaymentError(503, 'Online payments are not available right now. Please contact support.');
    if (!Number.isInteger(amount) || amount < 100) throw new PaymentError(400, 'Amount must be at least ₹1.');
    const [user] = await q('SELECT name, email, phone FROM users WHERE id = ?', [userId]);
    const wallet = await ensureWallet(userId);
    const notes = { purpose, user_id: String(userId), ...(invoiceId ? { invoice_id: String(invoiceId) } : {}) };
    const order = await razorpay.createOrder({ amount, receipt: `${purpose}_${userId}_${Date.now()}`, notes, customerId, recurringToken });

    await q(
        'INSERT INTO payment_orders (order_id, user_id, purpose, invoice_id, amount) VALUES (?, ?, ?, ?, ?) RETURNING order_id',
        [order.id, userId, purpose, invoiceId, amount],
    );
    await q(
        `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, razorpay_order_id, status)
         VALUES (?, 'credit', ?, ?, ?, ?, 'pending')`,
        [wallet.id, amount, `${description} (Razorpay order ${order.id})`.slice(0, 255), order.id, order.id],
    );

    return {
        key: razorpay.keyId(),
        orderId: order.id,
        amount,
        currency: 'INR',
        name: 'Walras Cloud',
        description,
        prefill: { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
        ...(customerId ? { customerId, recurring: true } : {}),
    };
};

const orderOf = async (orderId) => (await q('SELECT * FROM payment_orders WHERE order_id = ?', [orderId]))[0] || null;

// Set by utils/autoTopup.js (it requires this module, so no require cycle here).
const hooks = { setupCaptured: null, chargeCaptured: null, chargeFailed: null };

/**
 * A captured payment for one of our orders: credit once, then the purpose's
 * follow-up. Resolves { credited, purpose, userId }.
 */
const handleCaptured = async (orderId, payment) => {
    const order = await orderOf(orderId);
    if (!order) return { credited: false, purpose: null };
    if (payment && Number(payment.amount) !== Number(order.amount)) {
        // Never happens for a genuine order (Razorpay charges the order amount); refuse to guess.
        console.error(`[Razorpay] Payment ${payment.id} amount ${payment.amount} doesn't match order ${orderId} (${order.amount}); not credited.`);
        return { credited: false, purpose: order.purpose };
    }
    const paymentId = payment?.id || null;
    const credit = { description: `${PURPOSES[order.purpose] || 'Payment'} (Razorpay ${paymentId || orderId})`, paymentRef: paymentId };
    let result = await creditPendingTopup(orderId, credit);
    // Paid after the abandoned checkout's pending transaction was removed: still credited, once.
    if (!result.credited && order.status === 'expired') result = await creditExpiredTopup(orderId, credit);
    await q('UPDATE payment_orders SET status = ?, payment_id = COALESCE(?, payment_id), updated_at = NOW() WHERE order_id = ?', ['paid', paymentId, orderId]);
    if (result.credited) {
        // Required lazily: monthlyBilling pulls in most of the billing code.
        const billing = require('./monthlyBilling');
        try {
            if (order.purpose === 'autotopup_setup' && hooks.setupCaptured) await hooks.setupCaptured(order, payment);
            if (order.purpose === 'autotopup_charge' && hooks.chargeCaptured) await hooks.chargeCaptured(order, payment);
        } catch (err) {
            console.error(`[Razorpay] Follow-up for ${order.purpose} ${orderId} failed:`, err.message);
        }
        await billing.applyBalance(order.user_id, { first: order.invoice_id ? Number(order.invoice_id) : null })
            .catch((e) => console.error('[Razorpay] Paying invoices from the payment failed:', e.message));
    }
    return { credited: result.credited, purpose: order.purpose, userId: order.user_id, invoiceId: order.invoice_id };
};

/** A failed attempt. Only a server-initiated auto top-up charge fails for good. */
const handleFailed = async (orderId, payment) => {
    const order = await orderOf(orderId);
    if (!order || order.purpose !== 'autotopup_charge' || order.status !== 'created') return;
    const reason = payment?.error_description || payment?.error_reason || 'Payment declined';
    await failPendingTopup(orderId, `Auto top-up failed: ${reason}`);
    await q("UPDATE payment_orders SET status = 'failed', payment_id = COALESCE(?, payment_id), updated_at = NOW() WHERE order_id = ?", [payment?.id || null, orderId]);
    if (hooks.chargeFailed) await hooks.chargeFailed(order, reason).catch((e) => console.error('[Razorpay] Auto top-up failure handling failed:', e.message));
};

/**
 * Checkout's success handler result, sent by the browser. The signature
 * proves Razorpay issued it; the payment is then read back from Razorpay.
 */
const verifyCheckout = async (userId, { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = {}) => {
    if (![orderId, paymentId, signature].every((v) => typeof v === 'string' && v)) throw new PaymentError(400, 'Missing payment details.');
    if (!razorpay.verifyCheckoutSignature({ orderId, paymentId, signature })) throw new PaymentError(400, "This payment couldn't be verified.");
    const order = await orderOf(orderId);
    if (!order || Number(order.user_id) !== Number(userId)) throw new PaymentError(404, 'Payment not found.');
    const payment = await razorpay.fetchPayment(paymentId);
    if (payment.order_id !== orderId) throw new PaymentError(400, "This payment couldn't be verified.");
    if (payment.status === 'captured') return { ...(await handleCaptured(orderId, payment)), status: 'paid' };
    // Authorised and about to be captured (payment_capture is on): the webhook or reconcile() credits it.
    return { credited: false, purpose: order.purpose, status: payment.status === 'failed' ? 'failed' : 'processing' };
};

/** Webhook body (already signature-checked). */
const handleWebhook = async (event) => {
    const payment = event?.payload?.payment?.entity;
    if (!payment?.order_id) return 'ignored';
    if (event.event === 'payment.captured' || (event.event === 'order.paid' && payment.status === 'captured')) {
        const r = await handleCaptured(payment.order_id, payment);
        return r.credited ? 'credited' : 'already handled';
    }
    if (event.event === 'payment.failed') {
        await handleFailed(payment.order_id, payment);
        return 'failed noted';
    }
    return 'ignored';
};

/**
 * Safety net for missed webhooks (every 15 minutes, services/billingServices
 * cron): orders still open after 10 minutes are checked with Razorpay. A
 * checkout nobody paid within 3 hours is expired and its pending transaction
 * removed; it's still checked for a day after that (and the webhook still
 * works), so a UPI or bank payment that completes late is still credited.
 */
const reconcile = async () => {
    if (!razorpay.isConfigured()) return;
    const open = await q(
        `SELECT order_id, purpose FROM payment_orders
          WHERE created_at < NOW() - INTERVAL '10 minutes'
            AND ((status = 'created' AND created_at > NOW() - INTERVAL '3 days')
              OR (status = 'expired' AND created_at > NOW() - INTERVAL '1 day'))
          ORDER BY created_at LIMIT 100`,
    );
    for (const { order_id: orderId, purpose } of open) {
        try {
            const payments = await razorpay.fetchOrderPayments(orderId);
            const captured = payments.find((p) => p.status === 'captured');
            if (captured) await handleCaptured(orderId, captured);
            else if (purpose === 'autotopup_charge' && payments.length && payments.every((p) => p.status === 'failed')) await handleFailed(orderId, payments[0]);
        } catch (err) {
            console.error(`[Razorpay] Checking order ${orderId} failed:`, err.message);
        }
    }
    // Abandoned checkouts: nobody paid within 3 hours. The order is kept (a late
    // payment is matched to it); its pending (or older cancelled) transaction goes.
    // Auto top-up charges are excluded: Razorpay debits those about 36 hours later.
    await q(
        `UPDATE payment_orders SET status = 'expired', updated_at = NOW()
          WHERE status = 'created' AND purpose <> 'autotopup_charge' AND created_at <= NOW() - INTERVAL '${PENDING_TTL_HOURS} hours'`,
    );
    await q(
        `DELETE FROM wallet_transactions
          WHERE type = 'credit' AND status IN ('pending', 'cancelled')
            AND reference_id IN (SELECT order_id FROM payment_orders WHERE status = 'expired')`,
    );
};

module.exports = { PENDING_TTL_HOURS, PURPOSES, PaymentError, startCheckout, handleCaptured, handleFailed, verifyCheckout, handleWebhook, reconcile, hooks };
