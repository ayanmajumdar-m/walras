/**
 * CCAvenue Standing Instructions (SI), on-demand: the customer approves a
 * standing instruction once during a normal checkout (with OTP); after that
 * we can charge it from the server, as and when needed, up to its limit.
 * Used by auto top-up (utils/autoTopup.js).
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ NOT LIVE YET. Every field name and API command below marked VERIFY   │
 * │ must be checked against CCAvenue's SI integration document for this │
 * │ merchant account before SPEC_CONFIRMED is set to true. Until then   │
 * │ auto top-up can't be switched on (Admin → Settings shows why), no   │
 * │ checkout carries SI fields and nothing is ever charged.             │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Everything CCAvenue-specific about SI lives in this file, so finishing it
 * means editing only here. What is already known to work the same way as
 * the rest of the CCAvenue integration: AES-128-CBC with the working key
 * (services/ccavenueService.js), and the server-to-server API endpoint
 * (DoWebTrans with enc_request / access_code / command).
 */
const ccavenue = require('./ccavenueService');

// Set to true once every VERIFY item below matches CCAvenue's SI document.
const SPEC_CONFIRMED = false;

// RBI e-mandate rules: debits above this need the customer's OTP every time,
// which an automatic top-up can't get. So no single auto debit goes above it.
const MAX_DEBIT_PAISE = 15000 * 100;

// RBI: the customer must be told about each debit in advance (24 hours for
// card mandates). We notify, wait this long, then charge.
const PRE_DEBIT_HOURS = 24;

// VERIFY: API command names for SI on this account.
const COMMANDS = {
    charge: 'chargeSI',
    cancel: 'cancelSI',
    preDebitNotice: 'siPreDebitNotification',
    orderStatus: 'orderStatusTracker',
};

const apiUrl = () => {
    const isTest = (ccavenue.getConfig().actionUrl || '').includes('test.ccavenue.com');
    return isTest
        ? 'https://apitest.ccavenue.com/apis/servlet/DoWebTrans'
        : 'https://api.ccavenue.com/apis/servlet/DoWebTrans';
};

const ddmmyyyy = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

/**
 * Extra fields for the first (setup) checkout that register an on-demand SI.
 * The setup payment itself is a normal top-up of the amount the customer
 * chose. VERIFY every field name and value.
 */
const registrationFields = ({ refNo, maxDebitPaise }) => ({
    si_type: 'ONDEMAND',
    si_mer_ref_no: refNo,
    si_is_setup_amt: 'Y',
    si_amount: (Math.min(maxDebitPaise, MAX_DEBIT_PAISE) / 100).toFixed(2),
    si_start_date: ddmmyyyy(new Date()),
});

/**
 * From the decrypted checkout response: did the SI get registered, and its
 * reference and a card label to show the customer. VERIFY field names.
 */
const readRegistration = (data) => {
    const ref = data.si_ref_no || data.si_sub_ref_no || '';
    const status = String(data.si_status || data.si_created || '').toLowerCase();
    const ok = Boolean(ref) && !/fail|reject|n$/.test(status);
    const card = [data.card_name, data.payment_mode].filter(Boolean).join(' · ');
    return { ok, ref, cardLabel: card || 'Saved payment method', error: ok ? null : (data.si_error_desc || 'The bank did not approve automatic payments.') };
};

/** POST one API command; resolves with the decrypted JSON reply. */
const call = async (command, payload) => {
    if (!SPEC_CONFIRMED) throw new Error('CCAvenue Standing Instructions are not set up yet.');
    const config = ccavenue.getConfig();
    if (!config.isConfigured) throw new Error('CCAvenue is not configured.');
    const body = new URLSearchParams({
        enc_request: ccavenue.encrypt(JSON.stringify(payload), config.workingKey),
        access_code: config.accessCode,
        command,
        request_type: 'JSON',
        response_type: 'JSON',
        version: '1.2',
    });
    const res = await fetch(apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const reply = Object.fromEntries(new URLSearchParams(text.trim()));
    if (reply.status !== '0') {
        // On failure CCAvenue sends the reason in enc_response, not encrypted.
        throw new Error(reply.enc_response || reply.enc_error_code || `CCAvenue ${command} failed`);
    }
    return JSON.parse(ccavenue.decrypt(reply.enc_response.trim(), config.workingKey));
};

/** Tell the customer a debit is coming (RBI pre-debit notice). VERIFY payload. */
const sendPreDebitNotice = ({ siRef, amountPaise, orderId, debitDate }) => call(COMMANDS.preDebitNotice, {
    si_sub_ref_no: siRef,
    si_amount: (amountPaise / 100).toFixed(2),
    si_mer_charge_ref_no: orderId,
    si_debit_date: ddmmyyyy(debitDate),
});

/**
 * Charge the SI. Resolves { status: 'success' | 'failed' | 'pending',
 * trackingId, error }. VERIFY payload and reply fields.
 */
const charge = async ({ siRef, amountPaise, orderId }) => {
    const r = await call(COMMANDS.charge, {
        si_sub_ref_no: siRef,
        si_mer_charge_ref_no: orderId,
        si_amount: (amountPaise / 100).toFixed(2),
        si_currency: 'INR',
    });
    const raw = String(r.si_charge_status ?? r.status ?? '').toLowerCase();
    const status = ['0', 'success', 'successful'].includes(raw) ? 'success'
        : ['pending', 'initiated', 'awaited'].includes(raw) ? 'pending' : 'failed';
    return { status, trackingId: r.reference_no || r.tracking_id || null, error: status === 'failed' ? (r.si_error_desc || r.error_desc || 'Payment declined') : null };
};

/** Status of a charge left pending, by our order id. */
const chargeStatus = async (orderId) => {
    const r = await call(COMMANDS.orderStatus, { order_no: orderId });
    const raw = String(r.order_status || '').toLowerCase();
    const status = ['shipped', 'successful', 'success'].includes(raw) ? 'success'
        : ['aborted', 'unsuccessful', 'failure', 'invalid', 'cancelled', 'refunded'].includes(raw) ? 'failed' : 'pending';
    return { status, trackingId: r.reference_no || null, error: status === 'failed' ? (r.order_status_date_time ? `Payment ${raw}` : 'Payment declined') : null };
};

/** Cancel the SI at CCAvenue (customer switched auto top-up off). VERIFY payload. */
const cancel = (siRef) => call(COMMANDS.cancel, { si_sub_ref_no: siRef });

module.exports = {
    SPEC_CONFIRMED,
    MAX_DEBIT_PAISE,
    PRE_DEBIT_HOURS,
    registrationFields,
    readRegistration,
    sendPreDebitNotice,
    charge,
    chargeStatus,
    cancel,
};
