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
 * { credited: false } when it was already completed, failed or unknown.
 * 'cancelled' is an abandoned checkout we expired (utils/payments.js): a
 * payment Razorpay captures for it after all is still credited.
 */
// paymentRef goes in razorpay_payment_id: the Razorpay payment id.
const creditPendingTopup = async (orderId, { description, paymentRef } = {}) => {
    const rows = await q(
        `WITH tx AS (
            UPDATE wallet_transactions
               SET status = 'completed',
                   description = COALESCE(?, description),
                   razorpay_payment_id = COALESCE(?, razorpay_payment_id)
             WHERE reference_id = ? AND status IN ('pending', 'cancelled') AND type = 'credit'
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

/** Marks a pending top-up failed (no balance change). */
const failPendingTopup = (orderId, description) => q(
    "UPDATE wallet_transactions SET status = 'failed', description = ? WHERE reference_id = ? AND status = 'pending'",
    [String(description || 'Payment failed').slice(0, 255), orderId],
);

module.exports = { creditPendingTopup, failPendingTopup };
