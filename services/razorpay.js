/**
 * Razorpay: the payment gateway for account balance top-ups, invoice
 * payments and auto top-up (recurring card payments).
 *
 * REST API over fetch with the key id/secret (Basic auth); no SDK. Keys come
 * from the server environment (utils/integrations.js):
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET  API keys (Dashboard → API Keys)
 *   RAZORPAY_WEBHOOK_SECRET               the secret set on the webhook
 *   RAZORPAY_RECURRING=enabled            only once Razorpay has enabled
 *                                         recurring payments on the account
 *
 * Checkout (browser) → POST /verify with the signed result, and the webhook
 * (payment.captured / payment.failed) reports the same payments; crediting
 * is exactly-once either way (utils/walletCredit.js).
 *
 * Recurring (auto top-up), cards: an authorisation payment through Checkout
 * with recurring on creates a token; once the token is "confirmed", each
 * charge is a new order plus POST /payments/create/recurring. Razorpay sends
 * the RBI pre-debit notification itself and debits about 36 hours later.
 * https://razorpay.com/docs/api/payments/recurring-payments/
 */
const crypto = require('crypto');
const integrations = require('../utils/integrations');

const API = 'https://api.razorpay.com/v1';

// RBI: card debits above this need the cardholder's OTP each time, which an
// automatic charge can't get, so no single auto debit goes above it.
const MAX_DEBIT_PAISE = 15000 * 100;
// How long after a recurring charge is requested Razorpay debits it (its
// pre-debit notification period).
const DEBIT_DELAY_HOURS = 36;

class RazorpayError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const keyId = () => integrations.get('RAZORPAY_KEY_ID') || '';
const keySecret = () => integrations.get('RAZORPAY_KEY_SECRET') || '';
const webhookSecret = () => integrations.get('RAZORPAY_WEBHOOK_SECRET') || '';

const isConfigured = () => Boolean(keyId() && keySecret());

/** Recurring payments can be used: keys set and Razorpay has enabled recurring. */
const recurringReady = () => isConfigured() && Boolean(webhookSecret())
    && String(integrations.get('RAZORPAY_RECURRING') || '').toLowerCase() === 'enabled';

const call = async (method, path, body) => {
    if (!isConfigured()) throw new RazorpayError('Razorpay is not configured.', 503);
    let res;
    try {
        res = await fetch(`${API}${path}`, {
            method,
            headers: {
                Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`,
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(20000),
        });
    } catch (err) {
        throw new RazorpayError(`Razorpay unreachable: ${err.message}`, 502);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = data?.error?.description || `Razorpay returned ${res.status}`;
        console.warn('Razorpay request failed:', method, path.replace(/\/(order|pay|cust|token)_[A-Za-z0-9]+/g, '/$1_…'), res.status, message);
        throw new RazorpayError(message, res.status, data?.error);
    }
    return data;
};

// ── Orders and payments ────────────────────────────────────────────────────

/** A new order, captured automatically on payment. Amount in paise. */
const createOrder = ({ amount, receipt, notes = {}, customerId, recurringToken }) => call('POST', '/orders', {
    amount: Math.round(amount),
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    notes,
    payment_capture: true,
    ...(customerId ? { customer_id: customerId } : {}),
    // Authorisation order for card recurring: what the token may later charge.
    ...(recurringToken ? {
        method: 'card',
        token: { max_amount: recurringToken.maxAmount, expire_at: recurringToken.expireAt, frequency: 'as_presented' },
    } : {}),
});

const fetchPayment = (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}?expand[]=card`);
const fetchOrderPayments = async (orderId) => (await call('GET', `/orders/${encodeURIComponent(orderId)}/payments`)).items || [];

/** Checkout's signature: HMAC-SHA256(order_id|payment_id) with the key secret. */
const verifyCheckoutSignature = ({ orderId, paymentId, signature }) => {
    if (!keySecret() || typeof signature !== 'string') return false;
    const expected = crypto.createHmac('sha256', keySecret()).update(`${orderId}|${paymentId}`).digest('hex');
    return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
const verifyWebhookSignature = (rawBody, signature) => {
    if (!webhookSecret() || typeof signature !== 'string') return false;
    const expected = crypto.createHmac('sha256', webhookSecret()).update(rawBody).digest('hex');
    return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

// ── Recurring (cards) ──────────────────────────────────────────────────────

/** The customer's Razorpay customer id (existing one returned for the same details). */
const ensureCustomer = async ({ name, email, contact }) => (await call('POST', '/customers', {
    name: String(name || 'Customer').slice(0, 50),
    email,
    ...(contact ? { contact: String(contact) } : {}),
    fail_existing: '0',
})).id;

/** A token's recurring status: initiated | confirmed | rejected | cancelled | paused. */
const tokenStatus = async (customerId, tokenId) => {
    const t = await call('GET', `/customers/${encodeURIComponent(customerId)}/tokens/${encodeURIComponent(tokenId)}`);
    return { status: t?.recurring_details?.status || null, reason: t?.recurring_details?.failure_reason || null };
};

const deleteToken = (customerId, tokenId) => call('DELETE', `/customers/${encodeURIComponent(customerId)}/tokens/${encodeURIComponent(tokenId)}`);

/** Charges a confirmed token: a new order, then the recurring payment. */
const chargeToken = async ({ customerId, tokenId, amount, receipt, notes, email, contact, description }) => {
    const order = await createOrder({ amount, receipt, notes });
    const payment = await call('POST', '/payments/create/recurring', {
        email,
        contact: String(contact || ''),
        amount: Math.round(amount),
        currency: 'INR',
        order_id: order.id,
        customer_id: customerId,
        token: tokenId,
        recurring: true,
        description,
        notes,
    });
    return { orderId: order.id, paymentId: payment.razorpay_payment_id || null };
};

/** "Visa •••• 4242" from a payment fetched with its card. */
const cardLabel = (payment) => {
    const c = payment?.card;
    if (!c) return payment?.method === 'upi' ? 'UPI' : 'Saved card';
    return `${c.network || 'Card'} •••• ${c.last4 || ''}`.trim();
};

module.exports = {
    RazorpayError,
    MAX_DEBIT_PAISE,
    DEBIT_DELAY_HOURS,
    keyId,
    isConfigured,
    recurringReady,
    createOrder,
    fetchPayment,
    fetchOrderPayments,
    verifyCheckoutSignature,
    verifyWebhookSignature,
    ensureCustomer,
    tokenStatus,
    deleteToken,
    chargeToken,
    cardLabel,
};
