/**
 * Billing → Auto top-up (utils/autoTopup.js). Under /api/wallet, so team
 * members need the Billing area; cancelling (DELETE) needs the Admin role.
 */
const autoTopup = require('../utils/autoTopup');
const { PaymentError } = require('../utils/payments');
const { RazorpayError } = require('../services/razorpay');

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof autoTopup.AutoTopupError || err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
        if (err instanceof RazorpayError) {
            console.error(`Auto top-up ${req.method} ${req.path} (Razorpay) failed:`, err.message);
            return res.status(502).json({ error: "We couldn't reach the payment gateway. Please try again in a moment." });
        }
        console.error(`Auto top-up ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

module.exports = {
    // GET /api/wallet/auto-topup
    get: handle(async (req, res) => res.json(await autoTopup.view(req.user.userId))),

    // PUT /api/wallet/auto-topup { threshold, target, enabled }
    update: handle(async (req, res) => res.json(await autoTopup.update(req.user.userId, req.body || {}))),

    // POST /api/wallet/auto-topup/setup { threshold, target } → { checkout } for Razorpay Checkout
    setup: handle(async (req, res) => res.json(await autoTopup.startSetup(req.user.userId, req.body || {}))),

    // DELETE /api/wallet/auto-topup — switch off and remove the saved card
    cancel: handle(async (req, res) => res.json(await autoTopup.cancel(req.user.userId))),
};
