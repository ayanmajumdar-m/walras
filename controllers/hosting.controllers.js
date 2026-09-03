const connection = require("../config/db");
const cpanelService = require("../services/cpanelService");

// Helper: ensure wallet exists for a user
function getWallet(userId) {
    return new Promise((resolve, reject) => {
        connection.query("SELECT * FROM wallets WHERE user_id = ?", [userId], (err, rows) => {
            if (err) return reject(err);
            if (rows.length) return resolve(rows[0]);

            connection.query("INSERT INTO wallets (user_id, balance) VALUES (?, 0)", [userId], (err2, res) => {
                if (err2) return reject(err2);
                connection.query("SELECT * FROM wallets WHERE id = ?", [res.insertId], (err3, newRows) => {
                    if (err3) return reject(err3);
                    resolve(newRows[0]);
                });
            });
        });
    });
}

// Helper: get user details
function getUser(userId) {
    return new Promise((resolve, reject) => {
        connection.query("SELECT * FROM users WHERE id = ?", [userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows[0] || null);
        });
    });
}

/**
 * 🟢 GET user's hosting accounts
 */
exports.getUserHosting = async (req, res) => {
    try {
        const userId = req.user.userId;

        connection.query(
            `SELECT id, user_id, plan_name, cpanel_package, domain, cpanel_username, 
                    status, billing_cycle, amount, currency, expires_at, suspended_at, 
                    suspension_reason, created_at, updated_at 
             FROM hosting_accounts 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [userId],
            (err, results) => {
                if (err) {
                    console.error("Get user hosting error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                res.json({ hostingAccounts: results || [] });
            }
        );
    } catch (err) {
        console.error("Get user hosting error:", err);
        res.status(500).json({ error: "Failed to retrieve hosting accounts" });
    }
};

/**
 * 🟢 POST buy hosting plan & provision cPanel account
 */
exports.buyHosting = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { planName, domain, billingCycle = 'monthly' } = req.body;

        // Validation
        if (!planName || !domain) {
            return res.status(400).json({ error: "Plan name and domain are required" });
        }

        const normalizedPlan = planName.trim();
        if (!['Lite', 'Pro'].includes(normalizedPlan)) {
            return res.status(400).json({ error: "Invalid plan. Choose 'Lite' or 'Pro'" });
        }

        const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
        if (!cleanDomain || cleanDomain.length < 3) {
            return res.status(400).json({ error: "Please provide a valid domain name" });
        }

        // Payment terms: 1 Month, 6 Months, 12 Months, 36 Months
        const termConfigMap = {
            '1': { label: '1 Month', months: 1, days: 30, liteMonthly: 199, proMonthly: 449 },
            '6': { label: '6 Months', months: 6, days: 180, liteMonthly: 169, proMonthly: 389 },
            '12': { label: '12 Months', months: 12, days: 365, liteMonthly: 149, proMonthly: 349 },
            '36': { label: '36 Months', months: 36, days: 1095, liteMonthly: 119, proMonthly: 299 }
        };

        let termKey = '12';
        if (billingCycle) {
            const str = String(billingCycle).toLowerCase();
            if (str.includes('36')) termKey = '36';
            else if (str.includes('12') || str.includes('year')) termKey = '12';
            else if (str.includes('6')) termKey = '6';
            else if (str.includes('1') || str.includes('month')) termKey = '1';
        }

        const selectedTerm = termConfigMap[termKey] || termConfigMap['12'];
        const monthlyRate = normalizedPlan === 'Lite' ? selectedTerm.liteMonthly : selectedTerm.proMonthly;
        const totalAmountRupees = monthlyRate * selectedTerm.months;
        const totalPaise = totalAmountRupees * 100;
        const durationDays = selectedTerm.days;
        const formattedCycle = selectedTerm.label;

        // Verify wallet balance
        const wallet = await getWallet(userId);
        if (wallet.balance < totalPaise) {
            return res.status(400).json({
                error: "Insufficient wallet balance",
                required: totalPaise / 100,
                available: wallet.balance / 100
            });
        }

        // Get user for contact email
        const user = await getUser(userId);
        const contactEmail = user?.email || `user_${userId}@buttr.cloud`;

        // Generate cPanel credentials
        const cpanelUsername = cpanelService.generateCpanelUsername(cleanDomain);
        const cpanelPassword = cpanelService.generateSecurePassword();
        const cpanelPackage = cpanelService.getPackageForPlan(normalizedPlan);

        // Call cPanel / WHM API to create account
        const cpanelResult = await cpanelService.createAccount({
            username: cpanelUsername,
            domain: cleanDomain,
            plan: normalizedPlan,
            password: cpanelPassword,
            email: contactEmail
        });

        if (!cpanelResult.success) {
            return res.status(500).json({
                error: `cPanel account provisioning failed: ${cpanelResult.reason || 'Server error'}`
            });
        }

        // Database transaction: deduct wallet, log transaction, record hosting account
        connection.beginTransaction(async (txErr) => {
            if (txErr) {
                console.error("Transaction error:", txErr);
                return res.status(500).json({ error: "Transaction failed" });
            }

            // 1. Deduct wallet
            connection.query(
                "UPDATE wallets SET balance = balance - ? WHERE id = ? AND balance >= ?",
                [totalPaise, wallet.id, totalPaise],
                (wErr, wRes) => {
                    if (wErr || wRes.affectedRows === 0) {
                        return connection.rollback(() => {
                            res.status(400).json({ error: "Failed to deduct wallet balance" });
                        });
                    }

                    // 2. Insert wallet transaction
                    connection.query(
                        `INSERT INTO wallet_transactions 
                         (wallet_id, type, amount, description, reference_id, status) 
                         VALUES (?, 'debit', ?, ?, ?, 'completed')`,
                        [
                            wallet.id,
                            totalPaise,
                            `Web Hosting (${normalizedPlan} - ${formattedCycle}) for ${cleanDomain}`,
                            `hosting_${cpanelUsername}`
                        ],
                        (txLogErr) => {
                            if (txLogErr) {
                                return connection.rollback(() => {
                                    res.status(500).json({ error: "Failed to log transaction" });
                                });
                            }

                            // 3. Insert hosting account
                            connection.query(
                                `INSERT INTO hosting_accounts 
                                 (user_id, plan_name, cpanel_package, domain, cpanel_username, cpanel_password, 
                                  status, billing_cycle, amount, currency, expires_at) 
                                 VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 'INR', NOW() + (? || ' days')::INTERVAL)`,
                                [
                                    userId,
                                    normalizedPlan,
                                    cpanelPackage,
                                    cleanDomain,
                                    cpanelUsername,
                                    cpanelPassword,
                                    formattedCycle,
                                    totalPaise,
                                    durationDays
                                ],
                                (insertErr, insertRes) => {
                                    if (insertErr) {
                                        return connection.rollback(() => {
                                            console.error("Insert hosting account error:", insertErr);
                                            res.status(500).json({ error: "Failed to save hosting account" });
                                        });
                                    }

                                    const hostingId = insertRes.insertId;

                                    connection.commit((cErr) => {
                                        if (cErr) {
                                            return connection.rollback(() => {
                                                res.status(500).json({ error: "Commit failed" });
                                            });
                                        }

                                        console.log(`✅ Web Hosting account activated: ID ${hostingId}, User ${cpanelUsername}, Domain ${cleanDomain} (${formattedCycle})`);

                                        res.status(201).json({
                                            message: "Web Hosting activated successfully!",
                                            hostingAccount: {
                                                id: hostingId,
                                                domain: cleanDomain,
                                                plan_name: normalizedPlan,
                                                cpanel_package: cpanelPackage,
                                                cpanel_username: cpanelUsername,
                                                status: "active",
                                                billing_cycle: formattedCycle,
                                                amount: totalPaise / 100
                                            }
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    } catch (err) {
        console.error("Buy hosting error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * 🟢 GET cPanel Single Sign-On (SSO) login session URL
 */
exports.getCpanelLogin = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        connection.query(
            "SELECT * FROM hosting_accounts WHERE id = ? AND user_id = ?",
            [id, userId],
            async (err, rows) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ error: "Hosting account not found" });
                }

                const account = rows[0];

                if (account.status === 'suspended') {
                    return res.status(403).json({
                        error: "This hosting account is suspended due to expiry. Please renew your plan to reactivate access."
                    });
                }

                if (account.status === 'terminated') {
                    return res.status(400).json({ error: "This hosting account has been terminated." });
                }

                const sessionResult = await cpanelService.createUserSession(account.cpanel_username, account.domain);

                res.json({
                    success: true,
                    url: sessionResult.url,
                    username: account.cpanel_username,
                    domain: account.domain
                });
            }
        );
    } catch (err) {
        console.error("cPanel login error:", err);
        res.status(500).json({ error: "Failed to generate cPanel login session" });
    }
};

/**
 * 🟢 GET cPanel Credentials & Nameservers info
 */
exports.getHostingCredentials = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        connection.query(
            "SELECT * FROM hosting_accounts WHERE id = ? AND user_id = ?",
            [id, userId],
            (err, rows) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ error: "Hosting account not found" });
                }

                const account = rows[0];
                const config = cpanelService.getConfig();
                const cpanelDirectUrl = config.host
                    ? config.host.replace(':2087', ':2083')
                    : `https://${account.domain}:2083`;

                res.json({
                    id: account.id,
                    domain: account.domain,
                    plan: account.plan_name,
                    cpanel_package: account.cpanel_package,
                    username: account.cpanel_username,
                    password: account.cpanel_password,
                    cpanel_url: cpanelDirectUrl,
                    status: account.status,
                    expires_at: account.expires_at,
                    nameservers: [
                        process.env.CPANEL_NS1 || "ns1.buttrcloud.com",
                        process.env.CPANEL_NS2 || "ns2.buttrcloud.com"
                    ]
                });
            }
        );
    } catch (err) {
        console.error("Get hosting credentials error:", err);
        res.status(500).json({ error: "Failed to retrieve credentials" });
    }
};
