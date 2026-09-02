const cron = require('node-cron');
const connection = require('../config/db');
const taxService = require('./taxServices');
const cpanelService = require('./cpanelService');

class BillingService {
    constructor() {
        this.ratePerHour = 10; // ₹10 per hour per server
        this.setupCronJobs();
    }

    setupCronJobs() {
        // Run every hour at minute 0
        cron.schedule('0 * * * *', () => {
            console.log('🕒 Running hourly billing cycle...');
            this.processHourlyBilling();
        });

        // Run on 5th of every month at 00:00 for invoices
        cron.schedule('0 0 5 * *', () => {
            console.log('📅 Generating monthly invoices for previous month...');
            this.generateMonthlyInvoices();
        });

        // Check for expired hosting accounts every hour at minute 30
        cron.schedule('30 * * * *', () => {
            console.log('🕒 Checking for expired hosting accounts...');
            this.processExpiredHostingAccounts();
        });
    }

    async processExpiredHostingAccounts() {
        try {
            connection.query(
                "SELECT * FROM hosting_accounts WHERE status = 'active' AND expires_at <= NOW()",
                async (err, expiredAccounts) => {
                    if (err) {
                        console.error('Error fetching expired hosting accounts:', err);
                        return;
                    }

                    if (!expiredAccounts || expiredAccounts.length === 0) {
                        return;
                    }

                    console.log(`⚠️ Found ${expiredAccounts.length} expired hosting account(s) to suspend.`);

                    for (const account of expiredAccounts) {
                        try {
                            await cpanelService.suspendAccount(account.cpanel_username, 'Subscription expired');
                            connection.query(
                                `UPDATE hosting_accounts 
                                 SET status = 'suspended', suspended_at = NOW(), suspension_reason = 'Subscription expired' 
                                 WHERE id = ?`,
                                [account.id],
                                (upErr) => {
                                    if (upErr) console.error(`Error updating suspended status for hosting id ${account.id}:`, upErr);
                                    else console.log(`🔒 Suspended hosting account ${account.domain} (${account.cpanel_username})`);
                                }
                            );
                        } catch (suspendErr) {
                            console.error(`Failed to suspend hosting account ${account.cpanel_username}:`, suspendErr);
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Error in processExpiredHostingAccounts:', error);
        }
    }

    async processHourlyBilling() {
        try {
            // Get all active server usage (you'll need to track this)
            const activeServers = await this.getActiveServers();

            for (const server of activeServers) {
                await this.chargeUserForServerUsage(server);
            }

            console.log(`✅ Hourly billing completed for ${activeServers.length} servers`);
        } catch (error) {
            console.error('❌ Hourly billing error:', error);
        }
    }

    async getActiveServers() {
        return new Promise((resolve, reject) => {
            // Get all active servers that should be billed hourly
            connection.query(`
                SELECT s.*, u.id as user_id, w.id as wallet_id 
                FROM servers s 
                JOIN users u ON s.user_id = u.id 
                JOIN wallets w ON u.id = w.user_id 
                WHERE s.status = 'active'
            `, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    async chargeUserForServerUsage(server) {
        // Get user details for tax calculation
        const user = await this.getUserDetails(server.user_id);
        
        // Calculate base amount (without taxes)
        const baseAmount = Math.round(server.hourly_cost * 100); // Convert to paise
        
        // Calculate taxes based on user's location
        const taxData = taxService.calculateTax(user, baseAmount);
        const totalChargeAmount = taxData.totalAmount;

        return new Promise((resolve, reject) => {
            connection.beginTransaction(async (txErr) => {
                if (txErr) return reject(txErr);

                try {
                    // Check if user has sufficient balance
                    const wallet = await this.getWallet(server.wallet_id);

                    if (wallet.balance < totalChargeAmount) {
                        console.log(`⚠️ Insufficient balance for user ${server.user_id}. Stopping server.`);
                        await this.stopServer(server.id);
                        return resolve({ insufficient: true });
                    }

                    // Deduct from wallet
                    await this.deductFromWallet(server.wallet_id, totalChargeAmount);

                    // Record transaction
                    await this.recordBillingTransaction(server, totalChargeAmount, taxData);

                    // Log the billing
                    await this.logBilling(server, totalChargeAmount, taxData);

                    connection.commit((cErr) => {
                        if (cErr) {
                            connection.rollback(() => reject(cErr));
                        } else {
                            const taxInfo = taxData.taxAmount > 0 ? ` (Base: ₹${(baseAmount / 100).toFixed(2)}, Tax: ₹${(taxData.taxAmount / 100).toFixed(2)})` : '';
                            console.log(`💰 Deducted ₹${(totalChargeAmount / 100).toFixed(2)} from user ${server.user_id} for server ${server.id} (${server.name})${taxInfo}`);
                            resolve({ success: true, amount: totalChargeAmount, taxData });
                        }
                    });
                } catch (error) {
                    connection.rollback(() => reject(error));
                }
            });
        });
    }

    async getUserDetails(userId) {
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    async getWallet(walletId) {
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM wallets WHERE id = ?', [walletId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    async deductFromWallet(walletId, amount) {
        return new Promise((resolve, reject) => {
            connection.query(
                'UPDATE wallets SET balance = balance - ? WHERE id = ? AND balance >= ?',
                [amount, walletId, amount],
                (err, results) => {
                    if (err) reject(err);
                    else if (results.affectedRows === 0) {
                        reject(new Error('Insufficient balance or wallet not found'));
                    } else resolve();
                }
            );
        });
    }

    async recordBillingTransaction(server, amount, taxData) {
        const taxInfo = taxData.taxAmount > 0 ? ` (Tax: ₹${(taxData.taxAmount / 100).toFixed(2)})` : '';
        return new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO wallet_transactions 
                 (wallet_id, type, amount, description, reference_id, razorpay_payment_id, razorpay_order_id, status) 
                 VALUES (?, 'debit', ?, ?, ?, NULL, NULL, 'completed')`,
                [
                    server.wallet_id,
                    amount,
                    `Hourly charge - ${server.name} (${server.plan_name}) - ₹${(amount / 100).toFixed(2)}${taxInfo}`,
                    `billing_${server.id}_${Date.now()}`
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async logBilling(server, amount, taxData) {
        const taxInfo = taxData.taxAmount > 0 ? ` (Tax: ₹${(taxData.taxAmount / 100).toFixed(2)})` : '';
        return new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO billing_logs 
                 (user_id, server_id, amount, billing_period, description) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    server.user_id,
                    server.id,
                    amount,
                    new Date(),
                    `Hourly charge - ${server.name} (${server.plan_name}) - ₹${(amount / 100).toFixed(2)}${taxInfo}`
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async stopServer(serverId) {
        return new Promise((resolve, reject) => {
            connection.query(
                'UPDATE servers SET status = "stopped" WHERE id = ?',
                [serverId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async generateMonthlyInvoices() {
        try {
            console.log('🔄 Starting monthly invoice generation for previous month...');
            
            // Get the previous month (if today is 5th of current month, generate for previous month)
            const now = new Date();
            const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const monthYear = `${previousMonth.getFullYear()}-${(previousMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            
            console.log(`📅 Generating invoices for: ${previousMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`);

            // Get all users with billing in the previous month
            const users = await this.getUsersWithBilling(previousMonth);
            console.log(`👥 Found ${users.length} users with billing activity in ${monthYear}`);

            let generatedCount = 0;
            for (const user of users) {
                const result = await this.generateUserMonthlyInvoice(user, previousMonth);
                if (result) generatedCount++;
            }

            console.log(`✅ Generated ${generatedCount} monthly invoices for ${monthYear}`);
        } catch (error) {
            console.error('❌ Monthly invoice generation error:', error);
        }
    }

    async generateUserMonthlyInvoice(user, month) {
        return new Promise((resolve, reject) => {
            // Check if invoice already exists for this user and month
            connection.query(`
                SELECT id FROM monthly_invoices 
                WHERE user_id = ? AND to_char(billing_month, 'YYYY-MM') = to_char(?, 'YYYY-MM')
            `, [user.id, month], (err, existingInvoices) => {
                if (err) return reject(err);
                
                if (existingInvoices.length > 0) {
                    console.log(`Invoice already exists for user ${user.id} for ${month.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`);
                    return resolve(false);
                }

                // Get total billing amount for the month
                connection.query(`
                    SELECT COALESCE(SUM(amount), 0) as total_amount
                    FROM billing_logs 
                    WHERE user_id = ? AND to_char(billing_period, 'YYYY-MM') = to_char(?, 'YYYY-MM')
                `, [user.id, month], (err, billingResult) => {
                    if (err) return reject(err);
                    
                    const totalAmount = billingResult[0].total_amount;
                    if (totalAmount === 0) {
                        console.log(`No billing for user ${user.id} in ${month.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`);
                        return resolve(false);
                    }

                    // Generate invoice number
                    const invoiceNumber = `INV-${month.getFullYear()}-${(month.getMonth() + 1).toString().padStart(2, '0')}-${user.id}`;
                    
                    // Calculate due date (30 days from generation)
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + 30);

                    // Insert monthly invoice
                    connection.query(`
                        INSERT INTO monthly_invoices (user_id, invoice_number, billing_month, total_amount, due_date, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        user.id,
                        invoiceNumber,
                        month,
                        totalAmount,
                        dueDate,
                        `Monthly invoice for ${month.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} - Server usage billing`
                    ], (err, result) => {
                        if (err) return reject(err);
                        
                        console.log(`✅ Generated invoice ${invoiceNumber} for user ${user.name} (${user.id}): ₹${(totalAmount / 100).toFixed(2)}`);
                        resolve(true);
                    });
                });
            });
        });
    }

    async getUsersWithBilling(month) {
        return new Promise((resolve, reject) => {
            connection.query(`
                SELECT DISTINCT u.id, u.name, u.email, u.company, u.address
                FROM users u
                JOIN billing_logs bl ON u.id = bl.user_id
                WHERE to_char(bl.billing_period, 'YYYY-MM') = to_char(?, 'YYYY-MM')
            `, [month], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }
}

module.exports = new BillingService();