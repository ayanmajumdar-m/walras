const User = require('../model/User.model');
const Admin = require('../model/Admin.model');
const connection = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const audit = require('../utils/audit');
const { permissionsFor } = require('../utils/adminRbac');
dotenv.config();


const AdminController = {
    // Admin accounts are created from the Administrators page
    // (controllers/adminPlatform.controllers.js) or `node create-admin.js`.

    // Admin login
    login: (req, res) => {
        const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
        const { password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        Admin.findByUsername(username, async (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            const admin = results && results[0];
            const ok = admin && admin.is_active !== false && await bcrypt.compare(password, admin.password);
            if (!ok) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const role = admin.role || (admin.access === 'owner' ? 'super_admin' : 'finance');
            const token = jwt.sign({ adminId: admin.id, typ: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
            connection.query('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id], () => {});
            req.admin = { adminId: admin.id, username: admin.username };
            audit(req, 'admin.login', 'admin', admin.id);

            res.json({
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    fullName: admin.full_name,
                    role,
                    permissions: await permissionsFor(role),
                }
            });
        });
    },

    viewUsers: (req, res) => {
        Admin.getAllUsers((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },
    deleteUser: (req, res) => {
        const userId = req.params.id;
        // Deleting the user cascades to their server rows but not to the VMs on
        // SolusVM, which would keep running, unbilled and untracked.
        connection.query('SELECT COUNT(*) AS n FROM servers WHERE user_id = ?', [userId], (countErr, rows) => {
            if (countErr) return res.status(500).json({ error: 'Database error' });
            const n = Number(rows[0].n);
            if (n > 0) {
                return res.status(409).json({ error: `This customer has ${n} server${n === 1 ? '' : 's'}, so they can't be deleted yet. Suspend the account instead, or delete it once their servers have been cancelled and removed.` });
            }
            Admin.deleteUserById(userId, (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }
                res.json({ message: 'User deleted successfully' });
            });
        });
    },
    getUser: (req, res) => {
        const userId = req.params.id;
        Admin.getUserById(userId, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (result.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(result[0]);
        });
    },
    getTotalUsers: (req, res) => {
        Admin.getTotalUsers((err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(result[0]);
        });
    },
    getTotalServers: (req, res) => {
        Admin.getTotalServers((err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(result[0]);
        });
    },

    getAllDomains: (req, res) => {
        Admin.getAllDomains((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results); // Send all results, not just results[0]
        });
    },

    getTotalBillingLogs: (req, res) => {
        Admin.getTotalBillingLogs((err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(result[0]);
        });
    },
    getTotalInvoices: (req, res) => {
        Admin.getTotalInvoices((err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(result[0]);
        });
    },
    getTotalRevenue: (req, res) => {
        Admin.getTotalRevenue((err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(result[0]);
        });
    },

    // Get all users with comprehensive details
    getAllUsersWithDetails: (req, res) => {
        Admin.getAllUsersWithDetails((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            // users.* carries the password hash; it never leaves the server.
            res.json(results.map(({ password_hash, ...user }) => user));
        });
    },

    // Get user transactions
    getUserTransactions: (req, res) => {
        const userId = req.params.id;
        Admin.getUserTransactions(userId, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get all transactions
    getAllTransactions: (req, res) => {
        Admin.getAllTransactions((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get billing logs
    getBillingLogs: (req, res) => {
        Admin.getBillingLogs((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get user billing logs
    getUserBillingLogs: (req, res) => {
        const userId = req.params.id;
        Admin.getUserBillingLogs(userId, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get active sessions
    getActiveSessions: (req, res) => {
        Admin.getActiveSessions((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get unique IPs
    getUniqueIPs: (req, res) => {
        Admin.getUniqueIPs((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get dashboard statistics
    getDashboardStats: (req, res) => {
        Admin.getDashboardStats((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results[0]);
        });
    },

    // Get user servers
    getUserServers: (req, res) => {
        const userId = req.params.id;
        Admin.getUserServers(userId, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get all servers
    getAllServers: (req, res) => {
        Admin.getAllServers((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get recent activity
    getRecentActivity: (req, res) => {
        Admin.getRecentActivity((err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get user IP addresses
    getUserIPs: (req, res) => {
        const userId = req.params.id;
        User.getUserIPs(userId, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Get user sessions
    getUserSessions: (req, res) => {
        const userId = req.params.id;
        User.getUserSessions(userId, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    },

    // Force logout user session
    forceLogout: (req, res) => {
        const { sessionId } = req.body;
        User.logoutSession(sessionId, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Session logged out successfully' });
        });
    },

    // Update user status (activate/deactivate)
    updateUserStatus: (req, res) => {
        const { userId, status } = req.body;
        const query = 'UPDATE users SET isVerified = ? WHERE id = ?';
        connection.query(query, [status, userId], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'User status updated successfully' });
        });
    },

    verifyUser: (req, res) => {
        const { userId } = req.body;
        const query = 'UPDATE users SET isVerified = true WHERE id = ?';
        connection.query(query, [userId], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'User verified successfully' });
        });
    },



    // 🟢 GET all promo codes
    getAllPromoCodes: async (req, res) => {
        try {
            // First try the query with created_by column
            connection.query(`
                SELECT pc.*, a.username as created_by_name,
                       (SELECT COUNT(*) FROM promo_code_usage pcu WHERE pcu.promo_code_id = pc.id) as usage_count
                FROM promo_codes pc
                LEFT JOIN admins a ON pc.created_by = a.id
                ORDER BY pc.created_at DESC
            `, (err, results) => {
                if (err) {
                    // If created_by column doesn't exist, use fallback query
                    if (err.code === 'ER_BAD_FIELD_ERROR') {
                        connection.query(`
                            SELECT pc.*, 'Unknown' as created_by_name,
                                   (SELECT COUNT(*) FROM promo_code_usage pcu WHERE pcu.promo_code_id = pc.id) as usage_count
                            FROM promo_codes pc
                            ORDER BY pc.created_at DESC
                        `, (fallbackErr, fallbackResults) => {
                            if (fallbackErr) {
                                console.error('Get promo codes fallback error:', fallbackErr);
                                return res.status(500).json({ error: 'Database error' });
                            }

                            const formatted = fallbackResults.map(promo => ({
                                ...promo,
                                credit_amount: (promo.credit_amount / 100).toFixed(2),
                                expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString() : null,
                                created_at: new Date(promo.created_at).toISOString()
                            }));

                            res.json({ promoCodes: formatted });
                        });
                    } else {
                        console.error('Get promo codes error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                } else {
                    const formatted = results.map(promo => ({
                        ...promo,
                        credit_amount: (promo.credit_amount / 100).toFixed(2),
                        expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString() : null,
                        created_at: new Date(promo.created_at).toISOString()
                    }));

                    res.json({ promoCodes: formatted });
                }
            });
        } catch (err) {
            console.error('Get promo codes error:', err);
            res.status(500).json({ error: 'Failed to get promo codes' });
        }
    },

    // 🟢 POST create promo code
    createPromoCode: async (req, res) => {
        try {
            const { code, description, creditAmount, usageLimit, expiresAt } = req.body;
            const adminId = req.admin.adminId;

            if (!code || !creditAmount) {
                return res.status(400).json({ error: 'Code and credit amount are required' });
            }
            // A negative "credit" would take money from whoever redeems it.
            if (!Number.isFinite(Number(creditAmount)) || Number(creditAmount) <= 0) {
                return res.status(400).json({ error: 'Credit amount must be more than ₹0' });
            }

            const creditAmountPaise = Math.round(creditAmount * 100);
            const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

            // First try with created_by column
            connection.query(
                `INSERT INTO promo_codes (code, description, credit_amount, usage_limit, expires_at, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [code.toUpperCase(), description, creditAmountPaise, usageLimit || null, expiresAtDate, adminId],
                (err, result) => {
                    if (err) {
                        // If created_by column doesn't exist, try without it
                        if (err.code === 'ER_BAD_FIELD_ERROR') {
                            connection.query(
                                `INSERT INTO promo_codes (code, description, credit_amount, usage_limit, expires_at)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [code.toUpperCase(), description, creditAmountPaise, usageLimit || null, expiresAtDate],
                                (fallbackErr, fallbackResult) => {
                                    if (fallbackErr) {
                                        if (fallbackErr.code === 'ER_DUP_ENTRY') {
                                            return res.status(400).json({ error: 'Promo code already exists' });
                                        }
                                        console.error('Create promo code fallback error:', fallbackErr);
                                        return res.status(500).json({ error: 'Database error' });
                                    }

                                    res.json({
                                        message: 'Promo code created successfully',
                                        promoCode: {
                                            id: fallbackResult.insertId,
                                            code: code.toUpperCase(),
                                            description,
                                            credit_amount: creditAmount,
                                            usage_limit: usageLimit,
                                            expires_at: expiresAt,
                                            created_by: 'Unknown'
                                        }
                                    });
                                }
                            );
                        } else if (err.code === 'ER_DUP_ENTRY') {
                            return res.status(400).json({ error: 'Promo code already exists' });
                        } else {
                            console.error('Create promo code error:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                    } else {
                        res.json({
                            message: 'Promo code created successfully',
                            promoCode: {
                                id: result.insertId,
                                code: code.toUpperCase(),
                                description,
                                credit_amount: creditAmount,
                                usage_limit: usageLimit,
                                expires_at: expiresAt,
                                created_by: adminId
                            }
                        });
                    }
                }
            );
        } catch (err) {
            console.error('Create promo code error:', err);
            res.status(500).json({ error: 'Failed to create promo code' });
        }
    },

    // 🟢 PUT update promo code
    updatePromoCode: async (req, res) => {
        try {
            const { id } = req.params;
            const { description, usageLimit, expiresAt, isActive } = req.body;

            const updates = [];
            const values = [];

            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }

            if (usageLimit !== undefined) {
                updates.push('usage_limit = ?');
                values.push(usageLimit);
            }

            if (expiresAt !== undefined) {
                updates.push('expires_at = ?');
                values.push(expiresAt ? new Date(expiresAt) : null);
            }

            if (isActive !== undefined) {
                updates.push('is_active = ?');
                values.push(isActive);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(id);

            connection.query(
                `UPDATE promo_codes SET ${updates.join(', ')} WHERE id = ?`,
                values,
                (err, result) => {
                    if (err) {
                        console.error('Update promo code error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: 'Promo code not found' });
                    }

                    res.json({ message: 'Promo code updated successfully' });
                }
            );
        } catch (err) {
            console.error('Update promo code error:', err);
            res.status(500).json({ error: 'Failed to update promo code' });
        }
    },

    // 🟢 DELETE promo code
    deletePromoCode: async (req, res) => {
        try {
            const { id } = req.params;

            connection.query(
                'DELETE FROM promo_codes WHERE id = ?',
                [id],
                (err, result) => {
                    if (err) {
                        console.error('Delete promo code error:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({ error: 'Promo code not found' });
                    }

                    res.json({ message: 'Promo code deleted successfully' });
                }
            );
        } catch (err) {
            console.error('Delete promo code error:', err);
            res.status(500).json({ error: 'Failed to delete promo code' });
        }
    },

    // 🟢 GET promo code usage statistics
    getPromoCodeStats: async (req, res) => {
        try {
            connection.query(`
                SELECT 
                    pc.code,
                    pc.description,
                    pc.credit_amount,
                    pc.usage_limit,
                    pc.used_count,
                    pc.is_active,
                    pc.expires_at,
                    COUNT(pcu.id) as actual_usage,
                    pc.credit_amount * COUNT(pcu.id) as total_credits_given
                FROM promo_codes pc
                LEFT JOIN promo_code_usage pcu ON pc.id = pcu.promo_code_id
                GROUP BY pc.id
                ORDER BY pc.created_at DESC
            `, (err, results) => {
                if (err) {
                    console.error('Get promo code stats error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                const formatted = results.map(stat => ({
                    ...stat,
                    credit_amount: (stat.credit_amount / 100).toFixed(2),
                    total_credits_given: (stat.total_credits_given / 100).toFixed(2),
                    expires_at: stat.expires_at ? new Date(stat.expires_at).toISOString() : null
                }));

                res.json({ promoCodeStats: formatted });
            });
        } catch (err) {
            console.error('Get promo code stats error:', err);
            res.status(500).json({ error: 'Failed to get promo code stats' });
        }
    },
};

module.exports = AdminController;