const cron = require('node-cron');
const connection = require('../config/db');
const cpanelService = require('./cpanelService');
const autoTopup = require('../utils/autoTopup');
const monthlyBilling = require('../utils/monthlyBilling');

class BillingService {
    constructor() {
        this.setupCronJobs();
    }

    setupCronJobs() {
        // Local development points at a scratch database; never let it charge
        // wallets, suspend cPanel accounts or issue invoices.
        if (process.env.DISABLE_BILLING === 'true') {
            console.log('⏸️  DISABLE_BILLING=true — billing and suspension jobs are not scheduled.');
            return;
        }

        // Postpaid monthly billing (utils/monthlyBilling.js): invoices on the
        // 1st at 00:00 India time, and every 15 minutes the overdue timeline
        // (late fee, suspension, deletion), balance payments and cancelled
        // plans ending. The old hourly balance deductions are gone.
        cron.schedule('0 0 1 * *', () => {
            console.log('📅 Issuing monthly invoices...');
            monthlyBilling.run().then(() => autoTopup.run());
        }, { timezone: 'Asia/Kolkata' });
        cron.schedule('*/15 * * * *', () => monthlyBilling.run().then(() => autoTopup.run()));

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
}

module.exports = new BillingService();