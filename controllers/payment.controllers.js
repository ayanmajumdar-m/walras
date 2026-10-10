/**
 * Razorpay payments (utils/payments.js does the work):
 *   POST /api/payment/razorpay/topup    start an account balance top-up
 *   POST /api/payment/razorpay/verify   Checkout's success result
 *   POST /api/payment/razorpay/webhook  Razorpay's events (raw body, signed)
 * Invoice payments start at POST /api/invoices/:id/pay and auto top-up setup
 * at POST /api/wallet/auto-topup/setup; both finish through /verify.
 */
const payments = require('../utils/payments');
const razorpay = require('../services/razorpay');

const handle = (label, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof payments.PaymentError) return res.status(err.status).json({ error: err.message });
        if (err instanceof razorpay.RazorpayError) {
            console.error(`${label} (Razorpay) failed:`, err.message);
            return res.status(502).json({ error: "We couldn't reach the payment gateway. Please try again in a moment." });
        }
        console.error(`${label} failed:`, err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const MESSAGES = {
    topup: 'Payment received. Your account balance has been credited.',
    invoice: 'Payment received and applied to your invoice.',
    autotopup_setup: 'Payment received and added to your balance. Your card is saved for auto top-up.',
};

// POST /api/payment/razorpay/topup { amount } (rupees)
exports.startTopup = handle('Top-up', async (req, res) => {
    const rupees = Number(req.body?.amount);
    if (!Number.isFinite(rupees) || rupees < 1 || rupees > 500000) {
        return res.status(400).json({ error: 'Enter an amount between ₹1 and ₹5,00,000.' });
    }
    const checkout = await payments.startCheckout({
        userId: req.user.userId,
        purpose: 'topup',
        amount: Math.round(rupees * 100),
        description: 'Account balance top-up',
    });
    res.json({ checkout });
});

// POST /api/payment/razorpay/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
exports.verify = handle('Payment verify', async (req, res) => {
    const r = await payments.verifyCheckout(req.user.userId, req.body || {});
    if (r.status === 'failed') return res.status(402).json({ error: 'The payment failed. Nothing was charged; please try again.' });
    res.json({
        status: r.status, // 'paid', or 'processing' while Razorpay finishes capturing it
        purpose: r.purpose,
        message: r.status === 'paid'
            ? (MESSAGES[r.purpose] || 'Payment received.')
            : 'Payment received. It will show in your balance in a few minutes.',
    });
});

// POST /api/payment/razorpay/webhook — req.body is the raw Buffer (routes/payment.routes.js)
exports.webhook = async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    if (!razorpay.verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) {
        return res.status(400).json({ error: 'Invalid signature' });
    }
    let event;
    try {
        event = JSON.parse(raw.toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'Invalid body' });
    }
    try {
        const outcome = await payments.handleWebhook(event);
        res.json({ ok: true, outcome });
    } catch (err) {
        // 5xx makes Razorpay retry the event later.
        console.error('[Razorpay] Webhook handling failed:', err.message);
        res.status(500).json({ error: 'Webhook handling failed' });
    }
};
