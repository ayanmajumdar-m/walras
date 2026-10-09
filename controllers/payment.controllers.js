const connection = require('../config/db');
const ccavenueService = require('../services/ccavenueService');
const { creditPendingTopup, failPendingTopup } = require('../utils/walletCredit');
const autoTopup = require('../utils/autoTopup');
const monthlyBilling = require('../utils/monthlyBilling');
const { ensureWallet } = require('../utils/wallets');

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
                [wallet.id, amountPaise, `CCAvenue Account Balance Top-up (Order ${orderId})`, orderId],
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
            amount: data.amount,
            merchant_param2: data.merchant_param2
        });

        const { order_id, tracking_id, bank_ref_no, order_status, failure_message, amount } = data;
        const isSuccess = (order_status || '').toLowerCase() === 'success';

        // ==========================================
        // 🔁 1. AUTO TOP-UP SETUP (first payment + standing instruction)
        // ==========================================
        if ((order_id && order_id.startsWith('CCAS_')) || data.merchant_param2 === 'autotopup_setup') {
            const result = await autoTopup.completeSetup(data);
            return res.redirect(
                `${config.clientUrl}/dashboard/billing?autotopup=${result.ok ? 'on' : 'failed'}&message=${encodeURIComponent(result.message)}`
            );
        }

        // ==========================================
        // 🧾 2. INVOICE PAYMENT: into the balance, then straight onto the invoice
        // ==========================================
        if ((order_id && order_id.startsWith('CCAI_')) || data.merchant_param2 === 'invoice_payment') {
            if (!isSuccess) {
                await failPendingTopup(order_id, `Invoice payment failed: ${failure_message || order_status}`);
                return res.redirect(`${config.clientUrl}/dashboard/billing?tab=invoices&invoice=failed&reason=${encodeURIComponent(failure_message || order_status || 'Payment failed')}`);
            }
            const result = await creditPendingTopup(order_id, {
                description: `Invoice payment received (Ref: ${tracking_id || bank_ref_no || order_id})`,
                paymentRef: tracking_id || bank_ref_no || null,
            });
            const invoiceId = Number(data.merchant_param3 || String(order_id).split('_')[2]) || null;
            if (result.credited) await monthlyBilling.applyBalance(result.userId, { first: invoiceId });
            return res.redirect(`${config.clientUrl}/dashboard/billing?tab=invoices&invoice=paid`);
        }

        // ==========================================
        // 💰 3. WALLET TOP-UP FLOW
        // ==========================================
        if (isSuccess) {
            // Exactly once, even if CCAvenue calls back twice for this order.
            const result = await creditPendingTopup(order_id, {
                description: `CCAvenue Top-up Success (Ref: ${tracking_id || bank_ref_no || order_id})`,
                paymentRef: tracking_id || bank_ref_no || null,
            });
            if (!result.credited) console.warn("[CCAvenue] Transaction not in pending state or not found:", order_id);
            // Pay any unpaid invoice now (restarts suspended servers) rather than on
            // the next run; in the background, so the customer isn't kept waiting.
            else monthlyBilling.applyBalance(result.userId).catch((e) => console.error("[CCAvenue] Paying invoices from top-up failed:", e.message));
            return res.redirect(
                `${config.clientUrl}/dashboard/wallet?payment_status=success&order_id=${encodeURIComponent(order_id)}&amount=${encodeURIComponent(amount)}&tracking_id=${encodeURIComponent(tracking_id || '')}`
            );
        }
        await failPendingTopup(order_id, `CCAvenue Failed: ${failure_message || order_status}`);
        return res.redirect(
            `${config.clientUrl}/dashboard/wallet?payment_status=failed&order_id=${encodeURIComponent(order_id)}&reason=${encodeURIComponent(failure_message || order_status || 'Payment failed')}`
        );
    } catch (error) {
        console.error("[CCAvenue] Response callback error:", error);
        // The details are in the log; the customer gets a plain message, not a decryption error.
        return res.redirect(`${config.clientUrl}/dashboard/wallet?payment_status=failed&reason=${encodeURIComponent("We couldn't read the payment response. If money was taken, contact support@walras.net.")}`);
    }
};

/**
 * 🟢 POST /api/payment/ccavenue/cancel
 * Handles customer cancellation from CCAvenue hosted page
 */
exports.handleCcavenueCancel = async (req, res) => {
    const config = ccavenueService.getConfig();
    // CCAvenue posts the cancellation like a response: encrypted in encResp,
    // with the order number also as orderNo.
    // This endpoint is public: anything can be posted here, so read only strings.
    let orderId = [req.body?.orderNo, req.query?.order_id, req.body?.order_id].find((v) => typeof v === 'string') || '';
    if (typeof req.body?.encResp === 'string') {
        try {
            orderId = ccavenueService.parseResponse(ccavenueService.decrypt(req.body.encResp, config.workingKey)).order_id || orderId;
        } catch (err) {
            console.warn('[CCAvenue] Could not read the cancelled order:', err.message);
        }
    }
    if (orderId && orderId.startsWith('CCAI_')) {
        return res.redirect(`${config.clientUrl}/dashboard/billing?tab=invoices&invoice=cancelled`);
    }
    if (orderId && orderId.startsWith('CCAS_')) {
        // Auto top-up setup abandoned: nothing was charged or approved. (This
        // endpoint is public, so it changes nothing; starting setup again
        // replaces the unfinished one.)
        return res.redirect(`${config.clientUrl}/dashboard/billing?autotopup=cancelled`);
    }
    return res.redirect(`${config.clientUrl}/dashboard/wallet?payment_status=cancelled`);
};
