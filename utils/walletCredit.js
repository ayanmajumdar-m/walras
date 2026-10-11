/**
 * Completes a pending account balance top-up: marks its wallet_transactions
 * row completed and adds the amount to the wallet, in one statement.
 *
 * Razorpay can report the same payment more than once (Checkout's verify
 * call, the webhook, the reconcile job). Only the call that flips the row to
 * 'completed' gets a row back, so the balance is credited exactly once.
 */
const connection = require('../config/db');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

/**
 * Credits the pending top-up with reference_id = orderId.
 * Resolves { credited: true, amount, walletId, userId, balance } or
 * { credited: false } when it was already completed or is unknown.
 * 'failed' (and the older 'cancelled') can be an abandoned checkout we
 * expired (utils/payments.js): a payment Razorpay captures for it after all
 * is still credited, once.
 */
// paymentRef goes in razorpay_payment_id: the Razorpay payment id.
const creditPendingTopup = async (orderId, { description, paymentRef } = {}) => {
    const rows = await q(
        `WITH tx AS (
            UPDATE wallet_transactions
               SET status = 'completed',
                   description = COALESCE(?, description),
                   razorpay_payment_id = COALESCE(?, razorpay_payment_id)
             WHERE reference_id = ? AND status IN ('pending', 'cancelled', 'failed') AND type = 'credit'
         RETURNING wallet_id, amount
        )
        UPDATE wallets w SET balance = w.balance + tx.amount
          FROM tx WHERE w.id = tx.wallet_id
        RETURNING w.id AS wallet_id, w.user_id, w.balance, tx.amount`,
        [description || null, paymentRef || null, orderId],
    );
    const row = rows[0];
    return row
        ? { credited: true, amount: Number(row.amount), walletId: row.wallet_id, userId: row.user_id, balance: Number(row.balance) }
        : { credited: false };
};

/**
 * A payment captured for an order whose pending transaction was already
 * removed (an abandoned checkout, see utils/payments.js reconcile). Claims
 * the expired order once, then records the credit and adds it to the balance.
 */
const creditExpiredTopup = async (orderId, { description, paymentRef } = {}) => {
    const rows = await q(
        `WITH claim AS (
            UPDATE payment_orders SET status = 'paid', payment_id = COALESCE(?, payment_id), updated_at = NOW()
             WHERE order_id = ? AND status = 'expired'
               AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE reference_id = ? AND type = 'credit' AND status = 'completed')
         RETURNING user_id, amount
        ),
        w AS (
            UPDATE wallets w SET balance = w.balance + claim.amount
              FROM claim WHERE w.user_id = claim.user_id
            RETURNING w.id AS wallet_id, w.user_id, w.balance, claim.amount
        ),
        tx AS (
            INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, razorpay_order_id, razorpay_payment_id, status)
            SELECT w.wallet_id, 'credit', w.amount, ?, ?, ?, ?, 'completed' FROM w
            RETURNING id
        )
        SELECT w.* FROM w, tx`,
        [paymentRef || null, orderId, orderId, String(description || 'Payment').slice(0, 255), orderId, orderId, paymentRef || null],
    );
    const row = rows[0];
    return row
        ? { credited: true, amount: Number(row.amount), walletId: row.wallet_id, userId: row.user_id, balance: Number(row.balance) }
        : { credited: false };
};

/** Marks a pending top-up failed (no balance change). */
const failPendingTopup = (orderId, description) => q(
    "UPDATE wallet_transactions SET status = 'failed', description = ? WHERE reference_id = ? AND status = 'pending'",
    [String(description || 'Payment failed').slice(0, 255), orderId],
);

module.exports = { creditPendingTopup, creditExpiredTopup, failPendingTopup };
