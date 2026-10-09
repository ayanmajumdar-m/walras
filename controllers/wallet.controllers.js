const connection = require("../config/db");
const { creditPendingTopup } = require("../utils/walletCredit");
const qp = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const monthlyBilling = require("../utils/monthlyBilling");
const {
    createOrder,
    verifyPaymentSignature,
    verifyWebhookSignature,
} = require("../services/razorpayServices");

// Helper: ensure wallet exists for a user
async function ensureWallet(userId) {
    return new Promise((resolve, reject) => {
        connection.query("SELECT * FROM wallets WHERE user_id = ?", [userId], (err, rows) => {
            if (err) return reject(err);
            if (rows.length) return resolve(rows[0]);

            // create new wallet
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

// 🟢 GET wallet
exports.getWallet = async (req, res) => {
    try {
        const userId = req.user.userId; // Changed from req.user.id to req.user.userId
        const wallet = await ensureWallet(userId);
        // Prepaid (utils/monthlyBilling.js): servers renew on the 1st (India
        // time) for the month ahead. nextRenewal excludes GST.
        const next = monthlyBilling.istParts(monthlyBilling.nextMonthStart(new Date()));
        const nextInvoiceDate = `1st ${new Date(Date.UTC(next.y, next.m, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${next.y}`;
        const nextRenewal = await monthlyBilling.nextRenewal(userId);

        res.json({
            balance: (wallet.balance / 100).toFixed(2),
            nextRenewal: (nextRenewal / 100).toFixed(2),
            nextInvoiceDate,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch wallet" });
    }
};

// 🟢 POST create-order
exports.createOrderController = async (req, res) => {
    try {
        const userId = req.user.userId; // Changed from req.user.id to req.user.userId
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        const amountPaise = Math.round(amount * 100);
        const receipt = `wallet_${userId}_${Date.now()}`;
        await ensureWallet(userId); // the pending row below needs the wallet's id

        const order = await createOrder({
            amount: amountPaise,
            currency: "INR",
            receipt
        });

        // Save pending transaction
        connection.query(
            `INSERT INTO wallet_transactions 
        (wallet_id, type, amount, description, reference_id, razorpay_payment_id, razorpay_order_id, status)
        VALUES ((SELECT id FROM wallets WHERE user_id=?), 'credit', ?, ?, ?, NULL, ?, 'pending')`,
            [userId, amountPaise, `Razorpay Order ${order.id}`, order.id, order.id],
            (err) => {
                if (err) {
                    console.error("Insert tx error", err);
                    return res.status(500).json({ error: "Failed to create transaction" });
                }

                res.json({
                    orderId: order.id,
                    amount: order.amount,
                    currency: order.currency,
                    key: require('../utils/integrations').get('RAZORPAY_KEY_ID'),
                });
            }
        );
    } catch (err) {
        console.error("create-order error", err);
        res.status(500).json({ error: "Failed to create order" });
    }
};

// 🟢 POST verify payment (Razorpay checkout handler)
// Credits the pending top-up exactly once (utils/walletCredit.js): the
// webhook below may report the same payment, and only one of them credits.
exports.verifyPayment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: "Missing payment details" });
        }
        if (!verifyPaymentSignature({ order_id: razorpay_order_id, payment_id: razorpay_payment_id, signature: razorpay_signature })) {
            return res.status(400).json({ error: "Invalid signature" });
        }

        // The order must be this account's own pending top-up.
        const [tx] = await qp(
            `SELECT wt.amount, wt.status FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id
              WHERE wt.reference_id = ? AND w.user_id = ?`,
            [razorpay_order_id, userId],
        );
        if (!tx) return res.status(404).json({ error: "Transaction not found" });

        const result = await creditPendingTopup(razorpay_order_id, {
            description: `Razorpay top-up (Ref: ${razorpay_payment_id})`,
            paymentRef: razorpay_payment_id,
        });
        if (result.credited) {
            monthlyBilling.applyBalance(userId).catch((e) => console.error("[Razorpay] Paying invoices from top-up failed:", e.message));
        }
        // Already credited (e.g. by the webhook) is still a success for the customer.
        if (!result.credited && tx.status !== 'pending' && tx.status !== 'completed') {
            return res.status(409).json({ error: "This payment can't be credited. Please contact support." });
        }
        res.json({ message: "Account balance credited successfully", amount: (Number(tx.amount) / 100).toFixed(2) });
    } catch (err) {
        console.error("verify error", err);
        res.status(500).json({ error: "Verification failed" });
    }
};

// 🟢 POST webhook (Razorpay payment.captured): the same exactly-once credit.
exports.handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
        if (!verifyWebhookSignature(body, signature)) {
            return res.status(400).send("Invalid signature");
        }
        const payload = Buffer.isBuffer(req.body) ? JSON.parse(body) : req.body;
        if (payload.event !== "payment.captured") return res.status(200).send("OK - Event ignored");

        const payment = payload.payload.payment.entity;
        const result = await creditPendingTopup(payment.order_id, {
            description: `Razorpay top-up (Ref: ${payment.id})`,
            paymentRef: payment.id,
        });
        if (result.credited) {
            console.log(`Webhook: wallet ${result.walletId} credited with ${result.amount} paise`);
            monthlyBilling.applyBalance(result.userId).catch((e) => console.error("[Razorpay] Paying invoices from top-up failed:", e.message));
        }
        return res.status(200).send(result.credited ? "Credited" : "OK - Nothing pending");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("Server error");
    }
};

// 🟢 GET transactions
exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user.userId; // Changed from req.user.id to req.user.userId

        connection.query("SELECT id FROM wallets WHERE user_id = ?", [userId], (err, rows) => {
            if (err) {
                console.error("Get transactions error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            if (rows.length === 0) return res.json({ transactions: [] });

            const walletId = rows[0].id;
            connection.query(
                `SELECT type, amount, description, reference_id, razorpay_payment_id, razorpay_order_id, status, created_at 
         FROM wallet_transactions 
         WHERE wallet_id = ? 
         ORDER BY created_at DESC 
         LIMIT 100`,
                [walletId],
                (tErr, txRows) => {
                    if (tErr) {
                        console.error("Get transactions error:", tErr);
                        return res.status(500).json({ error: "Database error" });
                    }
                    const formatted = txRows.map((r) => ({
                        ...r,
                        amount: (r.amount / 100).toFixed(2),
                        status: r.status || 'completed',
                        payment_id: r.razorpay_payment_id || null,
                        order_id: r.razorpay_order_id || null
                    }));
                    res.json({ transactions: formatted });
                }
            );
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get transactions" });
    }
};

// Add to wallet.controller.js
exports.getBillingHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        connection.query(`
            SELECT bl.description, bl.amount, bl.billing_period, bl.created_at
            FROM billing_logs bl
            JOIN users u ON bl.user_id = u.id
            JOIN wallets w ON u.id = w.user_id
            WHERE bl.user_id = ?
            ORDER BY bl.created_at DESC
            LIMIT 50
        `, [userId], (err, results) => {
            if (err) {
                console.error('Billing history error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const formatted = results.map(item => ({
                ...item,
                amount: (item.amount / 100).toFixed(2),
                date: item.billing_period
            }));
            
            res.json({ billingHistory: formatted });
        });
    } catch (err) {
        console.error('Get billing history error:', err);
        res.status(500).json({ error: 'Failed to get billing history' });
    }
};

// 🟢 POST apply promo code
exports.applyPromoCode = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { promoCode } = req.body;

        if (!promoCode || !promoCode.trim()) {
            return res.status(400).json({ error: "Promo code is required" });
        }

        // Start transaction
        connection.beginTransaction(async (txErr) => {
            if (txErr) {
                console.error("Transaction error:", txErr);
                return res.status(500).json({ error: "Transaction error" });
            }

            try {
                // Check if promo code exists and is valid
                connection.query(
                    `SELECT * FROM promo_codes 
                     WHERE code = ? AND is_active = TRUE 
                     AND (expires_at IS NULL OR expires_at > NOW())
                     AND (usage_limit IS NULL OR used_count < usage_limit)`,
                    [promoCode.trim().toUpperCase()],
                    (err, promoRows) => {
                        if (err) {
                            return connection.rollback(() => {
                                res.status(500).json({ error: "Database error" });
                            });
                        }

                        if (promoRows.length === 0) {
                            return connection.rollback(() => {
                                res.status(400).json({ error: "Invalid or expired promo code" });
                            });
                        }

                        const promo = promoRows[0];

                        // Check if user has already used this promo code
                        connection.query(
                            `SELECT * FROM promo_code_usage 
                             WHERE promo_code_id = ? AND user_id = ?`,
                            [promo.id, userId],
                            (usageErr, usageRows) => {
                                if (usageErr) {
                                    return connection.rollback(() => {
                                        res.status(500).json({ error: "Database error" });
                                    });
                                }

                                if (usageRows.length > 0) {
                                    return connection.rollback(() => {
                                        res.status(400).json({ error: "You have already used this promo code" });
                                    });
                                }

                                // Get user's wallet
                                connection.query(
                                    "SELECT * FROM wallets WHERE user_id = ?",
                                    [userId],
                                    (walletErr, walletRows) => {
                                        if (walletErr) {
                                            return connection.rollback(() => {
                                                res.status(500).json({ error: "Database error" });
                                            });
                                        }

                                        if (walletRows.length === 0) {
                                            return connection.rollback(() => {
                                                res.status(500).json({ error: "Wallet not found" });
                                            });
                                        }

                                        const wallet = walletRows[0];

                                        // Add credit to wallet
                                        connection.query(
                                            "UPDATE wallets SET balance = balance + ? WHERE id = ?",
                                            [promo.credit_amount, wallet.id],
                                            (updateErr) => {
                                                if (updateErr) {
                                                    return connection.rollback(() => {
                                                        res.status(500).json({ error: "Failed to update wallet" });
                                                    });
                                                }

                                                // Record wallet transaction
                                                connection.query(
                                                    `INSERT INTO wallet_transactions 
                                                     (wallet_id, type, amount, description, reference_id, razorpay_payment_id, razorpay_order_id, status)
                                                     VALUES (?, 'credit', ?, ?, ?, NULL, NULL, 'completed')`,
                                                    [
                                                        wallet.id,
                                                        promo.credit_amount,
                                                        `Promo code credit - ${promo.code}`,
                                                        `promo_${promo.id}`
                                                    ],
                                                    (txErr) => {
                                                        if (txErr) {
                                                            return connection.rollback(() => {
                                                                res.status(500).json({ error: "Failed to create transaction" });
                                                            });
                                                        }

                                                        // Record promo code usage
                                                        connection.query(
                                                            `INSERT INTO promo_code_usage (promo_code_id, user_id)
                                                             VALUES (?, ?)`,
                                                            [promo.id, userId],
                                                            (usageErr) => {
                                                                if (usageErr) {
                                                                    return connection.rollback(() => {
                                                                        // promo_code_usage is unique per customer: a double click lands here
                                                                        if (usageErr.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "You have already used this promo code" });
                                                                        res.status(500).json({ error: "Failed to record promo usage" });
                                                                    });
                                                                }

                                                                // Update promo code usage count
                                                                connection.query(
                                                                    `UPDATE promo_codes SET used_count = used_count + 1
                                                                     WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)`,
                                                                    [promo.id],
                                                                    (countErr, countRes) => {
                                                                        if (countErr || !countRes.affectedRows) {
                                                                            return connection.rollback(() => {
                                                                                if (!countErr) return res.status(400).json({ error: "This promo code has reached its usage limit" });
                                                                                res.status(500).json({ error: "Failed to update usage count" });
                                                                            });
                                                                        }

                                                                        connection.commit((cErr) => {
                                                                            if (cErr) {
                                                                                return connection.rollback(() => {
                                                                                    res.status(500).json({ error: "Commit failed" });
                                                                                });
                                                                            }

                                                                            res.json({
                                                                                message: "Promo code applied successfully!",
                                                                                creditAmount: (promo.credit_amount / 100).toFixed(2),
                                                                                newBalance: ((wallet.balance + promo.credit_amount) / 100).toFixed(2)
                                                                            });
                                                                        });
                                                                    }
                                                                );
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            } catch (error) {
                connection.rollback(() => {
                    res.status(500).json({ error: "Failed to apply promo code" });
                });
            }
        });
    } catch (err) {
        console.error("Apply promo code error:", err);
        res.status(500).json({ error: "Failed to apply promo code" });
    }
};