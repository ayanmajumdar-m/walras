const connection = require('../config/db');
const ccavenueService = require('../services/ccavenueService');

/**
 * Ensure user has a wallet record
 */
async function ensureWallet(userId) {
    return new Promise((resolve, reject) => {
        connection.query("SELECT * FROM wallets WHERE user_id = ?", [userId], (err, rows) => {
            if (err) return reject(err);
            if (rows && rows.length) return resolve(rows[0]);

            connection.query(
                "INSERT INTO wallets (user_id, balance) VALUES (?, 0)",
                [userId],
                (err2, res) => {
                    if (err2) return reject(err2);
                    connection.query("SELECT * FROM wallets WHERE id = ?", [res.insertId], (err3, newRows) => {
                        if (err3) return reject(err3);
                        resolve(newRows[0]);
                    });
                }
            );
        });
    });
}

/**
 * 🟢 POST /api/payment/ccavenue/initiate-wallet
 * Initiates a wallet top-up transaction and returns encrypted CCAvenue payload
 */
exports.initiateWalletTopup = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User unauthorized" });
        }

        const { amount } = req.body;
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount < 1) {
            return res.status(400).json({ error: "Amount must be at least ₹1" });
        }

        const config = ccavenueService.getConfig();
        if (!config.isConfigured) {
            return res.status(500).json({
                error: "CCAvenue is not configured. Please set CCAVENUE_MERCHANT_ID, CCAVENUE_ACCESS_CODE, and CCAVENUE_WORKING_KEY in .env"
            });
        }

        // Fetch user profile for billing prefill
        const user = await new Promise((resolve) => {
            connection.query("SELECT * FROM users WHERE id = ?", [userId], (err, rows) => {
                if (err || !rows || !rows.length) resolve(null);
                else resolve(rows[0]);
            });
        });

        const wallet = await ensureWallet(userId);
        const amountPaise = Math.round(numAmount * 100);
        const orderId = `CCAW_${Date.now()}_${userId}`;

        // Insert pending wallet transaction
        await new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO wallet_transactions 
                (wallet_id, type, amount, description, reference_id, status)
                VALUES (?, 'credit', ?, ?, ?, 'pending')`,
                [wallet.id, amountPaise, `CCAvenue Wallet Top-up (Order ${orderId})`, orderId],
                (err) => {
                    if (err) {
                        console.error("[CCAvenue] Error creating pending tx:", err);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });

        const redirectUrl = `${config.clientUrl}/api/payment/ccavenue/response`;
        const cancelUrl = `${config.clientUrl}/api/payment/ccavenue/cancel`;

        const ccParams = {
            merchant_id: config.merchantId,
            order_id: orderId,
            currency: 'INR',
            amount: numAmount.toFixed(2),
            redirect_url: redirectUrl,
            cancel_url: cancelUrl,
            language: 'EN',
            billing_name: user?.name || 'Customer',
            billing_email: user?.email || '',
            billing_tel: user?.phone || '',
            merchant_param1: String(userId),
            merchant_param2: 'wallet_topup'
        };

        const plainText = ccavenueService.stringifyParams(ccParams);
        const encRequest = ccavenueService.encrypt(plainText, config.workingKey);

        res.json({
            success: true,
            actionUrl: config.actionUrl,
            encRequest: encRequest,
            accessCode: config.accessCode,
            orderId: orderId,
            amount: numAmount.toFixed(2)
        });
    } catch (error) {
        console.error("[CCAvenue] Initiate wallet error:", error);
        res.status(500).json({ error: error.message || "Failed to initiate payment" });
    }
};

/**
 * 🟢 POST /api/payment/ccavenue/response
 * Callback endpoint called by CCAvenue upon transaction completion
 */
exports.handleCcavenueResponse = async (req, res) => {
    const config = ccavenueService.getConfig();
    try {
        const { encResp } = req.body;
        if (!encResp) {
            console.error("[CCAvenue] Missing encResp in callback payload");
            return res.redirect(`${config.clientUrl}/dashboard/wallet?payment_status=failed&reason=Missing+response`);
        }

        const decryptedText = ccavenueService.decrypt(encResp, config.workingKey);
        const data = ccavenueService.parseResponse(decryptedText);

        console.log("[CCAvenue] Callback Decrypted:", {
            order_id: data.order_id,
            tracking_id: data.tracking_id,
            bank_ref_no: data.bank_ref_no,
            order_status: data.order_status,
            amount: data.amount
        });

        const { order_id, tracking_id, bank_ref_no, order_status, failure_message, amount } = data;
        const isSuccess = (order_status || '').toLowerCase() === 'success';

        if (isSuccess) {
            connection.query(
                "SELECT * FROM wallet_transactions WHERE reference_id = ? AND status = 'pending'",
                [order_id],
                (err, txRows) => {
                    if (err || !txRows || !txRows.length) {
                        console.warn("[CCAvenue] Transaction not in pending state or not found:", order_id);
                        return res.redirect(`${config.clientUrl}/dashboard/wallet?payment_status=success&order_id=${order_id}&amount=${amount}`);
                    }

                    const tx = txRows[0];
                    const amountPaise = tx.amount;
                    const walletId = tx.wallet_id;

                    connection.query(
                        "UPDATE wallets SET balance = balance + ? WHERE id = ?",
                        [amountPaise, walletId],
                        (wErr) => {
                            if (wErr) {
                                console.error("[CCAvenue] Failed to increment wallet balance:", wErr);
                            }

                            connection.query(
                                `UPDATE wallet_transactions 
                                 SET status = 'completed', 
                                     description = ?,
                                     razorpay_payment_id = ?
                                 WHERE id = ?`,
                                [
                                    `CCAvenue Top-up Success (Ref: ${tracking_id || bank_ref_no || order_id})`,
                                    tracking_id || bank_ref_no,
                                    tx.id
                                ],
                                () => {
                                    return res.redirect(
                                        `${config.clientUrl}/dashboard/wallet?payment_status=success&order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}&tracking_id=${encodeURIComponent(tracking_id || '')}`
                                    );
                                }
                            );
                        }
                    );
                }
            );
        } else {
            connection.query(
                "UPDATE wallet_transactions SET status = 'failed', description = ? WHERE reference_id = ?",
                [`CCAvenue Failed: ${failure_message || order_status}`, order_id],
                () => {
                    return res.redirect(
                        `${config.clientUrl}/dashboard/wallet?payment_status=failed&order_id=${encodeURIComponent(order_id)}&reason=${encodeURIComponent(failure_message || order_status || 'Payment failed')}`
                    );
                }
            );
        }
    } catch (error) {
        console.error("[CCAvenue] Response callback error:", error);
        return res.redirect(`${config.clientUrl}/dashboard/wallet?payment_status=error&reason=${encodeURIComponent(error.message)}`);
    }
};

/**
 * 🟢 POST /api/payment/ccavenue/cancel
 * Handles customer cancellation from CCAvenue hosted page
 */
exports.handleCcavenueCancel = async (req, res) => {
    const config = ccavenueService.getConfig();
    return res.redirect(`${config.clientUrl}/dashboard/wallet?payment_status=cancelled`);
};
