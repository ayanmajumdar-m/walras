const connection = require("../config/db");
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

// 🟢 POST verify payment
exports.verifyPayment = async (req, res) => {
    try {
        const userId = req.user.userId; // Changed from req.user.id to req.user.userId
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: "Missing payment details" });
        }

        const valid = verifyPaymentSignature({
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            signature: razorpay_signature,
        });

        if (!valid) {
            return res.status(400).json({ error: "Invalid signature" });
        }

        // Start transaction
        connection.beginTransaction(async (txErr) => {
            if (txErr) {
                console.error("Transaction error:", txErr);
                return res.status(500).json({ error: "Transaction error" });
            }

            try {
                // Get wallet with lock
                connection.query("SELECT * FROM wallets WHERE user_id = ? FOR UPDATE", [userId], (wErr, wRows) => {
                    if (wErr) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: "Database error" });
                        });
                    }

                    const proceedCredit = (walletId) => {
                        // Get order amount from pending transaction
                        connection.query(
                            "SELECT amount FROM wallet_transactions WHERE reference_id = ? AND status = 'pending'",
                            [razorpay_order_id],
                            (txErr, txRows) => {
                                if (txErr || txRows.length === 0) {
                                    return connection.rollback(() => {
                                        res.status(400).json({ error: "Transaction not found" });
                                    });
                                }

                                const amountPaise = txRows[0].amount;

                                // Update wallet balance
                                connection.query(
                                    "UPDATE wallets SET balance = balance + ? WHERE id = ?",
                                    [amountPaise, walletId],
                                    (uErr) => {
                                        if (uErr) {
                                            return connection.rollback(() => {
                                                res.status(500).json({ error: "Failed to update wallet" });
                                            });
                                        }

                                        // Update transaction status and add payment reference
                                        connection.query(
                                            `UPDATE wallet_transactions 
                       SET status = 'completed', razorpay_payment_id = ?, razorpay_order_id = ?
                       WHERE reference_id = ? AND status = 'pending'`,
                                            [razorpay_payment_id, razorpay_order_id, razorpay_order_id],
                                            (tErr) => {
                                                if (tErr) {
                                                    return connection.rollback(() => {
                                                        res.status(500).json({ error: "Failed to update transaction" });
                                                    });
                                                }

                                                connection.commit((cErr) => {
                                                    if (cErr) {
                                                        return connection.rollback(() => {
                                                            res.status(500).json({ error: "Commit failed" });
                                                        });
                                                    }
                                                    res.json({
                                                        message: "Account balance credited successfully",
                                                        amount: (amountPaise / 100).toFixed(2)
                                                    });
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    };

                    if (wRows.length === 0) {
                        // Create wallet if doesn't exist
                        connection.query(
                            "INSERT INTO wallets (user_id, balance) VALUES (?, 0)",
                            [userId],
                            (insErr, insRes) => {
                                if (insErr) {
                                    return connection.rollback(() => {
                                        res.status(500).json({ error: "Failed to create wallet" });
                                    });
                                }
                                proceedCredit(insRes.insertId);
                            }
                        );
                    } else {
                        proceedCredit(wRows[0].id);
                    }
                });
            } catch (error) {
                connection.rollback(() => {
                    res.status(500).json({ error: "Verification failed" });
                });
            }
        });
    } catch (err) {
        console.error("verify error", err);
        res.status(500).json({ error: "Verification failed" });
    }
};

// 🟢 POST webhook
exports.handleWebhook = (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const body = JSON.stringify(req.body);

        if (!verifyWebhookSignature(body, signature)) {
            return res.status(400).send("Invalid signature");
        }

        const payload = req.body;

        if (payload.event === "payment.captured") {
            const payment = payload.payload.payment.entity;
            const orderId = payment.order_id;
            const paymentId = payment.id;
            const amount = payment.amount;

            connection.query(
                `SELECT wt.*, w.user_id FROM wallet_transactions wt 
         JOIN wallets w ON wt.wallet_id = w.id 
         WHERE wt.reference_id = ? AND wt.status = 'pending' LIMIT 1`,
                [orderId],
                (err, rows) => {
                    if (err) {
                        console.error("Webhook DB error:", err);
                        return res.status(500).send("Database error");
                    }
                    if (rows.length === 0) return res.status(200).send("OK - No pending transaction");

                    const tx = rows[0];
                    const walletId = tx.wallet_id;

                    connection.beginTransaction((tErr) => {
                        if (tErr) return res.status(500).send("Transaction error");

                        // Update wallet balance
                        connection.query(
                            "UPDATE wallets SET balance = balance + ? WHERE id = ?",
                            [amount, walletId],
                            (uErr) => {
                                if (uErr) {
                                    return connection.rollback(() => {
                                        res.status(500).send("Update error");
                                    });
                                }

                                // Update transaction
                                connection.query(
                                    `UPDATE wallet_transactions 
                   SET status = 'completed', razorpay_payment_id = ?, razorpay_order_id = ?
                   WHERE reference_id = ? AND status = 'pending'`,
                                    [paymentId, orderId, orderId],
                                    (updErr) => {
                                        if (updErr) {
                                            return connection.rollback(() => {
                                                res.status(500).send("Transaction update error");
                                            });
                                        }

                                        connection.commit((cErr) => {
                                            if (cErr) {
                                                return connection.rollback(() => {
                                                    res.status(500).send("Commit error");
                                                });
                                            }
                                            console.log(`Webhook: Wallet ${walletId} credited with ${amount} paise`);
                                            return res.status(200).send("Credited");
                                        });
                                    }
                                );
                            }
                        );
                    });
                }
            );
        } else {
            return res.status(200).send("OK - Event ignored");
        }
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
                                                                        res.status(500).json({ error: "Failed to record promo usage" });
                                                                    });
                                                                }

                                                                // Update promo code usage count
                                                                connection.query(
                                                                    `UPDATE promo_codes SET used_count = used_count + 1 
                                                                     WHERE id = ?`,
                                                                    [promo.id],
                                                                    (countErr) => {
                                                                        if (countErr) {
                                                                            return connection.rollback(() => {
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