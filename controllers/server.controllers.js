const connection = require("../config/db");
const crypto = require('crypto');
const { getPlatform } = require('../utils/platformSettings');

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

// Calculate hourly cost with GST
function calculateHourlyCost(monthlyCost) {
    const hourlyBase = monthlyCost / (24 * 30); // Convert monthly to hourly
    const gst = hourlyBase * 0.18; // 18% GST
    return hourlyBase + gst;
}

// Generate random IP address for demo purposes
function generateRandomIP() {
    return `172.16.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// 🟢 POST deploy server
exports.deployServer = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { plan, hostname, rootPassword, location, os, notes, currency } = req.body;

        // Validate required fields
        if (!plan || !hostname || !rootPassword || !location || !os) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // The plan (and its price) comes from the browser, so only plans the
        // platform says are on sale may be deployed. Cloud Compute is locked
        // off while deployment is simulated; see utils/platformSettings.js.
        const { planAvailability } = await getPlatform();
        if (!planAvailability.compute[plan.name]) {
            return res.status(400).json({ error: "This plan is not available right now" });
        }

        // Calculate costs
        const monthlyCost = currency === "INR" ? plan.inr : plan.usd;
        const hourlyCost = calculateHourlyCost(monthlyCost);
        const hourlyCostPaise = Math.round(hourlyCost * 100);

        // Check wallet balance
        const wallet = await ensureWallet(userId);
        if (wallet.balance < hourlyCostPaise) {
            return res.status(400).json({ 
                error: "Insufficient wallet balance", 
                required: hourlyCostPaise / 100,
                available: wallet.balance / 100
            });
        }

        // Start transaction
        connection.beginTransaction(async (txErr) => {
            if (txErr) {
                console.error("Transaction error:", txErr);
                return res.status(500).json({ error: "Transaction error" });
            }

            try {
                // Create server record
                const serverData = {
                    user_id: userId,
                    name: hostname,
                    hostname: hostname,
                    root_password: rootPassword, // In production, this should be hashed
                    location: location,
                    os: os,
                    plan_id: plan.id,
                    plan_name: plan.name,
                    monthly_cost: monthlyCost,
                    hourly_cost: hourlyCost,
                    currency: currency,
                    ip_address: generateRandomIP(),
                    status: 'deploying',
                    notes: notes || ''
                };

                connection.query(
                    `INSERT INTO servers (user_id, name, hostname, root_password, location, os, plan_id, plan_name, monthly_cost, hourly_cost, currency, ip_address, status, notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        serverData.user_id, serverData.name, serverData.hostname, 
                        serverData.root_password, serverData.location, serverData.os,
                        serverData.plan_id, serverData.plan_name, serverData.monthly_cost,
                        serverData.hourly_cost, serverData.currency, serverData.ip_address,
                        serverData.status, serverData.notes
                    ],
                    (serverErr, serverRes) => {
                        if (serverErr) {
                            return connection.rollback(() => {
                                res.status(500).json({ error: "Failed to create server" });
                            });
                        }

                        const serverId = serverRes.insertId;

                        // Deduct first hour charge from wallet
                        connection.query(
                            "UPDATE wallets SET balance = balance - ? WHERE id = ?",
                            [hourlyCostPaise, wallet.id],
                            (walletErr) => {
                                if (walletErr) {
                                    return connection.rollback(() => {
                                        res.status(500).json({ error: "Failed to deduct wallet balance" });
                                    });
                                }

                                // Create wallet transaction record
                                connection.query(
                                    `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, razorpay_payment_id, razorpay_order_id, status) 
                                     VALUES (?, 'debit', ?, ?, ?, NULL, NULL, 'completed')`,
                                    [
                                        wallet.id, 
                                        hourlyCostPaise, 
                                        `Server deployment charge - ${hostname} (${plan.name})`, 
                                        `server_${serverId}`
                                    ],
                                    (txErr) => {
                                        if (txErr) {
                                            return connection.rollback(() => {
                                                res.status(500).json({ error: "Failed to create transaction record" });
                                            });
                                        }

                                        // Create billing log
                                        connection.query(
                                            `INSERT INTO billing_logs (user_id, server_id, amount, billing_period, description) 
                                             VALUES (?, ?, ?, NOW(), ?)`,
                                            [
                                                userId, 
                                                serverId, 
                                                hourlyCostPaise, 
                                                `Hourly charge for ${hostname} - ${plan.name}`
                                            ],
                                            (billingErr) => {
                                                if (billingErr) {
                                                    return connection.rollback(() => {
                                                        res.status(500).json({ error: "Failed to create billing log" });
                                                    });
                                                }

                                                connection.commit((cErr) => {
                                                    if (cErr) {
                                                        return connection.rollback(() => {
                                                            res.status(500).json({ error: "Commit failed" });
                                                        });
                                                    }

                                                    res.json({
                                                        message: "Server deployed successfully",
                                                        serverId: serverId,
                                                        server: {
                                                            ...serverData,
                                                            id: serverId
                                                        },
                                                        charge: hourlyCostPaise / 100
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
            } catch (error) {
                connection.rollback(() => {
                    res.status(500).json({ error: "Deployment failed" });
                });
            }
        });
    } catch (err) {
        console.error("Deploy server error:", err);
        res.status(500).json({ error: "Failed to deploy server" });
    }
};

// 🟢 GET user servers
exports.getUserServers = async (req, res) => {
    try {
        const userId = req.user.userId;

        connection.query(
            `SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC`,
            [userId],
            (err, results) => {
                if (err) {
                    console.error("Get user servers error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                const servers = results.map(server => ({
                    ...server,
                    monthly_cost: parseFloat(server.monthly_cost),
                    hourly_cost: parseFloat(server.hourly_cost)
                }));

                res.json({ servers });
            }
        );
    } catch (err) {
        console.error("Get user servers error:", err);
        res.status(500).json({ error: "Failed to get servers" });
    }
};

// 🟢 POST stop/start server
exports.manageServer = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { serverId, action } = req.body;

        if (!serverId || !action) {
            return res.status(400).json({ error: "Missing server ID or action" });
        }

        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ error: "Invalid action" });
        }

        // Check if server belongs to user
        connection.query(
            "SELECT * FROM servers WHERE id = ? AND user_id = ?",
            [serverId, userId],
            (err, results) => {
                if (err) {
                    console.error("Manage server error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: "Server not found" });
                }

                const server = results[0];
                let newStatus;

                switch (action) {
                    case 'start':
                        newStatus = 'active';
                        break;
                    case 'stop':
                        newStatus = 'stopped';
                        break;
                    case 'restart':
                        newStatus = server.status === 'active' ? 'active' : server.status;
                        break;
                }

                // Update server status
                connection.query(
                    "UPDATE servers SET status = ?, last_activity = NOW() WHERE id = ?",
                    [newStatus, serverId],
                    (updateErr) => {
                        if (updateErr) {
                            console.error("Update server status error:", updateErr);
                            return res.status(500).json({ error: "Failed to update server" });
                        }

                        res.json({
                            message: `Server ${action} successful`,
                            server: {
                                ...server,
                                status: newStatus,
                                last_activity: new Date()
                            }
                        });
                    }
                );
            }
        );
    } catch (err) {
        console.error("Manage server error:", err);
        res.status(500).json({ error: "Failed to manage server" });
    }
};

// 🟢 DELETE server
exports.deleteServer = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { serverId } = req.params;

        // Check if server belongs to user
        connection.query(
            "SELECT * FROM servers WHERE id = ? AND user_id = ?",
            [serverId, userId],
            (err, results) => {
                if (err) {
                    console.error("Delete server error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: "Server not found" });
                }

                // Delete server
                connection.query(
                    "DELETE FROM servers WHERE id = ? AND user_id = ?",
                    [serverId, userId],
                    (deleteErr) => {
                        if (deleteErr) {
                            console.error("Delete server error:", deleteErr);
                            return res.status(500).json({ error: "Failed to delete server" });
                        }

                        res.json({ message: "Server deleted successfully" });
                    }
                );
            }
        );
    } catch (err) {
        console.error("Delete server error:", err);
        res.status(500).json({ error: "Failed to delete server" });
    }
};
