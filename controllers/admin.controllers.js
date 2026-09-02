const User = require('../model/User.model');
const Admin = require('../model/Admin.model');
const connection = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const taxService = require('../services/taxServices');
const cpanelService = require('../services/cpanelService');
const dotenv = require('dotenv');
dotenv.config();


const AdminController = {
    register: async (req, res) => {
        try {
            const { username, password } = req.body;

            // Validate input
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            Admin.create({ username, password: hashedPassword }, (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Database error', details: err });
                }

                res.status(201).json({ message: 'Admin created successfully', adminId: result.insertId });
            });
        } catch (error) {
            console.error('Admin register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Admin login
    login: (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        Admin.findByUsername(username, async (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length === 0) return res.status(401).json({ error: 'Invalid username or password' });

            const admin = results[0];
            const isPasswordValid = await bcrypt.compare(password, admin.password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const token = jwt.sign({ adminId: admin.id, access: admin.access }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    access: admin.access
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
        const userId = req.params.id; // Use body instead of params
        Admin.deleteUserById(userId, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ message: 'User deleted successfully' });
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
            res.json(results);
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
            const adminId = req.params.id;

            if (!code || !creditAmount) {
                return res.status(400).json({ error: 'Code and credit amount are required' });
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
                    SUM(pc.credit_amount) as total_credits_given
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

    // 🟢 GET all monthly invoices
    getAllMonthlyInvoices: async (req, res) => {
        try {
            connection.query(`
                SELECT mi.*, u.name as user_name, u.email as user_email
                FROM monthly_invoices mi
                LEFT JOIN users u ON mi.user_id = u.id
                ORDER BY mi.generated_at DESC
            `, (err, results) => {
                if (err) {
                    console.error('Get monthly invoices error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                const formatted = results.map(invoice => ({
                    ...invoice,
                    total_amount: (invoice.total_amount / 100).toFixed(2),
                    billing_month: new Date(invoice.billing_month).toISOString(),
                    generated_at: new Date(invoice.generated_at).toISOString(),
                    due_date: new Date(invoice.due_date).toISOString(),
                    paid_at: invoice.paid_at ? new Date(invoice.paid_at).toISOString() : null
                }));

                res.json({ invoices: formatted });
            });
        } catch (err) {
            console.error('Get monthly invoices error:', err);
            res.status(500).json({ error: 'Failed to get monthly invoices' });
        }
    },

    // 🟢 GET user monthly invoices
    getUserMonthlyInvoices: async (req, res) => {
        try {
            const { userId } = req.params;

            connection.query(`
                SELECT mi.*, u.name as user_name, u.email as user_email
                FROM monthly_invoices mi
                LEFT JOIN users u ON mi.user_id = u.id
                WHERE mi.user_id = ?
                ORDER BY mi.generated_at DESC
            `, [userId], (err, results) => {
                if (err) {
                    console.error('Get user monthly invoices error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                const formatted = results.map(invoice => ({
                    ...invoice,
                    total_amount: (invoice.total_amount / 100).toFixed(2),
                    billing_month: new Date(invoice.billing_month).toISOString(),
                    generated_at: new Date(invoice.generated_at).toISOString(),
                    due_date: new Date(invoice.due_date).toISOString(),
                    paid_at: invoice.paid_at ? new Date(invoice.paid_at).toISOString() : null
                }));

                res.json({ invoices: formatted });
            });
        } catch (err) {
            console.error('Get user monthly invoices error:', err);
            res.status(500).json({ error: 'Failed to get user monthly invoices' });
        }
    },

    // 🟢 POST generate monthly invoices manually
    generateMonthlyInvoices: async (req, res) => {
        try {
            const billingService = require('../services/billingServices');
            await billingService.generateMonthlyInvoices();
            res.json({ message: 'Monthly invoices generated successfully' });
        } catch (err) {
            console.error('Generate monthly invoices error:', err);
            res.status(500).json({ error: 'Failed to generate monthly invoices' });
        }
    },

    // 🟢 POST create sample invoice for testing
    createSampleInvoice: async (req, res) => {
        try {
            // Get the first user from the database
            connection.query('SELECT id, name, email, company, address FROM users LIMIT 1', (err, users) => {
                if (err) {
                    console.error('Error fetching user:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (users.length === 0) {
                    return res.status(404).json({ error: 'No users found to create sample invoice' });
                }

                const user = users[0];
                const now = new Date();
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

                // Generate sample invoice
                const invoiceNumber = `INV-${lastMonth.getFullYear()}-${(lastMonth.getMonth() + 1).toString().padStart(2, '0')}-${user.id}`;
                const sampleAmount = 500000; // ₹5000 in paise
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30);

                connection.query(`
                    INSERT INTO monthly_invoices (user_id, invoice_number, billing_month, total_amount, due_date, notes, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending')
                `, [
                    user.id,
                    invoiceNumber,
                    lastMonth,
                    sampleAmount,
                    dueDate,
                    `Sample invoice for ${lastMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} - Server usage billing`
                ], (err, result) => {
                    if (err) {
                        console.error('Error creating sample invoice:', err);
                        return res.status(500).json({ error: 'Failed to create sample invoice' });
                    }

                    res.json({
                        message: 'Sample invoice created successfully',
                        invoice: {
                            id: result.insertId,
                            invoice_number: invoiceNumber,
                            user_name: user.name,
                            amount: (sampleAmount / 100).toFixed(2)
                        }
                    });
                });
            });
        } catch (err) {
            console.error('Create sample invoice error:', err);
            res.status(500).json({ error: 'Failed to create sample invoice' });
        }
    },

    // 🟢 PUT update invoice status
    updateInvoiceStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!['pending', 'paid', 'overdue'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const updates = ['status = ?'];
            const values = [status];

            if (status === 'paid') {
                updates.push('paid_at = NOW()');
            }

            if (notes) {
                updates.push('notes = ?');
                values.push(notes);
            }

            values.push(id);

            connection.query(`
                UPDATE monthly_invoices SET ${updates.join(', ')} WHERE id = ?
            `, values, (err, result) => {
                if (err) {
                    console.error('Update invoice status error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Invoice not found' });
                }

                res.json({ message: 'Invoice status updated successfully' });
            });
        } catch (err) {
            console.error('Update invoice status error:', err);
            res.status(500).json({ error: 'Failed to update invoice status' });
        }
    },

    // 🟢 GET download monthly invoice PDF
    downloadMonthlyInvoice: async (req, res) => {
        try {
            const { id } = req.params;

            // Get invoice details with user information
            const invoiceQuery = `
                SELECT mi.*, u.name as user_name, u.email as user_email, u.company, u.address
                FROM monthly_invoices mi
                LEFT JOIN users u ON mi.user_id = u.id
                WHERE mi.id = ?
            `;

            connection.query(invoiceQuery, [id], async (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: 'Invoice not found' });
                }

                const invoice = results[0];

                try {
                    // Generate PDF invoice
                    const PDFDocument = require('pdfkit');
                    const doc = new PDFDocument({ margin: 50 });

                    // Set response headers for PDF download
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="invoice_${invoice.invoice_number}_${new Date().toISOString().split('T')[0]}.pdf"`);

                    // Pipe PDF to response
                    doc.pipe(res);

                    // Invoice Header
                    doc.fontSize(24).text('INVOICE', 50, 50);
                    doc.fontSize(12).text(`Invoice Number: ${invoice.invoice_number}`, 50, 85);
                    doc.text(`Date: ${new Date(invoice.generated_at).toLocaleDateString()}`, 50, 100);
                    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 50, 115);
                    doc.text(`Status: ${invoice.status.toUpperCase()}`, 50, 130);

                    // Company Info
                    doc.text('ioogn Services', 400, 85)
                        .text('Cloud Infrastructure Provider', 400, 100)
                        .text('Billing Department', 400, 115)
                        .text('contact@ioogn.com', 400, 130)
                        .text('+91-9876543210', 400, 145);

                    // Customer Info
                    doc.text('Bill To:', 50, 180)
                        .text(invoice.user_name || 'N/A', 50, 195)
                        .text(invoice.company || 'N/A', 50, 210)
                        .text(invoice.user_email || 'N/A', 50, 225)
                        .text(invoice.address || 'N/A', 50, 240, { width: 200 });

                    // Billing Period
                    doc.text('Billing Period:', 50, 280)
                        .text(new Date(invoice.billing_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }), 50, 295);

                    // Invoice Details
                    let yPosition = 340;

                    // Table Header
                    doc.fillColor('#000000')
                        .rect(50, yPosition, 500, 25)
                        .fill()
                        .fillColor('#ffffff')
                        .fontSize(10)
                        .text('Description', 60, yPosition + 8)
                        .text('Period', 300, yPosition + 8)
                        .text('Amount (₹)', 450, yPosition + 8);

                    yPosition += 30;

                    // Calculate taxes using tax service
                    const user = {
                        address: invoice.address,
                        name: invoice.user_name,
                        email: invoice.user_email,
                        company: invoice.company
                    };

                    // For invoice display, we need to calculate what the base amount was before taxes
                    // Since the stored amount might already include taxes, we'll estimate the base amount
                    const storedAmount = invoice.total_amount;
                    const estimatedBaseAmount = Math.round(storedAmount / 1.18); // Rough estimate for 18% GST
                    const taxData = taxService.calculateTax(user, estimatedBaseAmount);

                    // Invoice Row
                    doc.fillColor('#ffffff')
                        .text('Monthly Server Usage', 60, yPosition)
                        .text(new Date(invoice.billing_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }), 300, yPosition)
                        .text((taxData.baseAmount / 100).toFixed(2), 450, yPosition);

                    yPosition += 25;

                    // Subtotal
                    doc.text('Subtotal', 60, yPosition)
                        .text((taxData.baseAmount / 100).toFixed(2), 450, yPosition);

                    yPosition += 20;

                    // Tax rows
                    if (taxData.taxAmount > 0) {
                        taxData.taxBreakdown.forEach(tax => {
                            doc.text(tax.description, 60, yPosition)
                                .text((tax.amount / 100).toFixed(2), 450, yPosition);
                            yPosition += 20;
                        });
                    }

                    // Total
                    doc.fillColor('#f0f0f0')
                        .rect(50, yPosition, 500, 30)
                        .fill()
                        .fillColor('#000000')
                        .fontSize(12)
                        .text('TOTAL', 60, yPosition + 8)
                        .text((taxData.totalAmount / 100).toFixed(2), 450, yPosition + 8);

                    // Payment Information
                    yPosition += 60;
                    doc.fontSize(10)
                        .text('Payment Information:', 50, yPosition)
                        .text('Bank: State Bank of India', 50, yPosition + 20)
                        .text('Account: 1234567890123456', 50, yPosition + 35)
                        .text('IFSC: SBIN0001234', 50, yPosition + 50)
                        .text('UPI: ioogn@paytm', 50, yPosition + 65);

                    // Footer
                    yPosition += 100;
                    doc.text('Thank you for your business!', 50, yPosition)
                        .text('For any queries, contact us at support@ioogn.com', 50, yPosition + 20)
                        .text('This is a computer-generated invoice.', 50, yPosition + 40);

                    // Finalize PDF
                    doc.end();

                } catch (pdfError) {
                    console.error('PDF generation error:', pdfError);
                    res.status(500).json({ error: 'Failed to generate invoice PDF' });
                }
            });

        } catch (error) {
            console.error('Download monthly invoice error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // 🟢 GET generate sample invoice
    generateSampleInvoice: async (req, res) => {
        try {
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 50 });

            // Set response headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="sample_invoice_${new Date().toISOString().split('T')[0]}.pdf"`);

            // Pipe PDF to response
            doc.pipe(res);

            // Sample data for different scenarios
            const sampleScenarios = [
                {
                    name: 'West Bengal Customer',
                    address: '123 Park Street\nKolkata\nWest Bengal\nIndia\n700016',
                    baseAmount: 10000, // ₹100.00
                    description: 'Sample West Bengal Customer - 18% GST'
                },
                {
                    name: 'Maharashtra Customer',
                    address: '456 Marine Drive\nMumbai\nMaharashtra\nIndia\n400001',
                    baseAmount: 10000, // ₹100.00
                    description: 'Sample Maharashtra Customer - 9% IGST + 9% SGST'
                },
                {
                    name: 'International Customer',
                    address: '789 Broadway\nNew York\nNew York\nUnited States\n10001',
                    baseAmount: 10000, // ₹100.00
                    description: 'Sample International Customer - No Taxes'
                }
            ];

            // Generate sample invoices for each scenario
            sampleScenarios.forEach((scenario, index) => {
                if (index > 0) {
                    doc.addPage();
                }

                // Invoice Header
                doc.fontSize(24).text('SAMPLE INVOICE', 50, 50);
                doc.fontSize(12).text(`Invoice Number: SAMPLE-${index + 1}-${new Date().getFullYear()}`, 50, 85);
                doc.text(`Date: ${new Date().toLocaleDateString()}`, 50, 100);
                doc.text(`Type: ${scenario.description}`, 50, 115);

                // Company Info
                doc.text('IOOGN Services', 400, 85)
                    .text('Cloud Infrastructure Provider', 400, 100)
                    .text('Billing Department', 400, 115)
                    .text('contact@ioogn.com', 400, 130)
                    .text('+91-9876543210', 400, 145);

                // Customer Info
                doc.text('Bill To:', 50, 180)
                    .text(scenario.name, 50, 195)
                    .text('Sample Company Ltd.', 50, 210)
                    .text('sample@email.com', 50, 225)
                    .text(scenario.address, 50, 240, { width: 200 });

                // Calculate taxes
                const user = {
                    address: scenario.address,
                    name: scenario.name,
                    email: 'sample@email.com',
                    company: 'Sample Company Ltd.'
                };
                const taxData = taxService.calculateTax(user, scenario.baseAmount);

                // Billing Table
                let yPosition = 340;

                // Table Header
                doc.fillColor('#000000')
                    .rect(50, yPosition, 500, 25)
                    .fill()
                    .fillColor('#ffffff')
                    .fontSize(10)
                    .text('Description', 60, yPosition + 8)
                    .text('Amount (₹)', 450, yPosition + 8);

                yPosition += 30;

                // Service Row
                doc.fillColor('#ffffff')
                    .text('Monthly Server Usage', 60, yPosition)
                    .text((taxData.baseAmount / 100).toFixed(2), 450, yPosition);

                yPosition += 25;

                // Subtotal
                doc.fillColor('#f8f8f8')
                    .rect(50, yPosition, 500, 20)
                    .fill()
                    .fillColor('#000000')
                    .text('Subtotal', 60, yPosition + 5)
                    .text((taxData.baseAmount / 100).toFixed(2), 450, yPosition + 5);
                yPosition += 25;

                // Tax rows
                if (taxData.taxAmount > 0) {
                    taxData.taxBreakdown.forEach(tax => {
                        doc.fillColor('#ffffff')
                            .text(tax.description, 60, yPosition)
                            .text((tax.amount / 100).toFixed(2), 450, yPosition);
                        yPosition += 20;
                    });
                } else {
                    doc.fillColor('#ffffff')
                        .text('No taxes applicable', 60, yPosition)
                        .text('0.00', 450, yPosition);
                    yPosition += 20;
                }

                // Total
                doc.fillColor('#f0f0f0')
                    .rect(50, yPosition, 500, 30)
                    .fill()
                    .fillColor('#000000')
                    .fontSize(12)
                    .text('TOTAL', 60, yPosition + 8)
                    .text((taxData.totalAmount / 100).toFixed(2), 450, yPosition + 8);

                // Tax Information
                yPosition += 60;
                doc.fontSize(10)
                    .text('Tax Information:', 50, yPosition)
                    .text(`Country: ${taxData.country}`, 50, yPosition + 20)
                    .text(`State: ${taxData.state}`, 50, yPosition + 35)
                    .text(`Tax Applied: ${taxData.taxAmount > 0 ? 'Yes' : 'No'}`, 50, yPosition + 50);

                // Footer
                yPosition += 100;
                doc.text('This is a sample invoice for demonstration purposes.', 50, yPosition)
                    .text('For any queries, contact us at support@ioogn.com', 50, yPosition + 20);
            });

            // Finalize PDF
            doc.end();

        } catch (error) {
            console.error('Generate sample invoice error:', error);
            res.status(500).json({ error: 'Failed to generate sample invoice' });
        }
    },

    // Hosting Management (cPanel)
    getAllHosting: async (req, res) => {
        try {
            connection.query(
                `SELECT h.*, u.name as user_name, u.email as user_email 
                 FROM hosting_accounts h 
                 LEFT JOIN users u ON h.user_id = u.id 
                 ORDER BY h.created_at DESC`,
                (err, results) => {
                    if (err) {
                        console.error("Admin get all hosting error:", err);
                        return res.status(500).json({ error: "Database error" });
                    }
                    res.json({ hostingAccounts: results || [] });
                }
            );
        } catch (error) {
            console.error("Admin get all hosting error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    suspendHosting: async (req, res) => {
        try {
            const { id } = req.params;
            const { reason = 'Suspended by Administrator' } = req.body || {};

            connection.query("SELECT * FROM hosting_accounts WHERE id = ?", [id], async (err, rows) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!rows || rows.length === 0) return res.status(404).json({ error: "Hosting account not found" });

                const account = rows[0];
                const cpanelRes = await cpanelService.suspendAccount(account.cpanel_username, reason);

                connection.query(
                    `UPDATE hosting_accounts 
                     SET status = 'suspended', suspended_at = NOW(), suspension_reason = ? 
                     WHERE id = ?`,
                    [reason, id],
                    (upErr) => {
                        if (upErr) return res.status(500).json({ error: "Failed to update database" });
                        res.json({ message: "Hosting account suspended successfully", cpanel: cpanelRes });
                    }
                );
            });
        } catch (error) {
            console.error("Admin suspend hosting error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    unsuspendHosting: async (req, res) => {
        try {
            const { id } = req.params;

            connection.query("SELECT * FROM hosting_accounts WHERE id = ?", [id], async (err, rows) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!rows || rows.length === 0) return res.status(404).json({ error: "Hosting account not found" });

                const account = rows[0];
                const cpanelRes = await cpanelService.unsuspendAccount(account.cpanel_username);

                connection.query(
                    `UPDATE hosting_accounts 
                     SET status = 'active', suspended_at = NULL, suspension_reason = NULL 
                     WHERE id = ?`,
                    [id],
                    (upErr) => {
                        if (upErr) return res.status(500).json({ error: "Failed to update database" });
                        res.json({ message: "Hosting account unsuspended successfully", cpanel: cpanelRes });
                    }
                );
            });
        } catch (error) {
            console.error("Admin unsuspend hosting error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    deleteHosting: async (req, res) => {
        try {
            const { id } = req.params;

            connection.query("SELECT * FROM hosting_accounts WHERE id = ?", [id], async (err, rows) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!rows || rows.length === 0) return res.status(404).json({ error: "Hosting account not found" });

                const account = rows[0];
                const cpanelRes = await cpanelService.removeAccount(account.cpanel_username);

                connection.query("DELETE FROM hosting_accounts WHERE id = ?", [id], (delErr) => {
                    if (delErr) return res.status(500).json({ error: "Failed to delete hosting account" });
                    res.json({ message: "Hosting account deleted successfully", cpanel: cpanelRes });
                });
            });
        } catch (error) {
            console.error("Admin delete hosting error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    },

    getHostingLogin: async (req, res) => {
        try {
            const { id } = req.params;

            connection.query("SELECT * FROM hosting_accounts WHERE id = ?", [id], async (err, rows) => {
                if (err) return res.status(500).json({ error: "Database error" });
                if (!rows || rows.length === 0) return res.status(404).json({ error: "Hosting account not found" });

                const account = rows[0];
                const sessionResult = await cpanelService.createUserSession(account.cpanel_username, account.domain);
                res.json({
                    success: true,
                    url: sessionResult.url,
                    username: account.cpanel_username,
                    domain: account.domain
                });
            });
        } catch (error) {
            console.error("Admin get hosting login error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
};

module.exports = AdminController;