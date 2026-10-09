const cron = require('node-cron');
const autoTopup = require('../utils/autoTopup');
const monthlyBilling = require('../utils/monthlyBilling');

class BillingService {
    constructor() {
        this.setupCronJobs();
    }

    setupCronJobs() {
        // Local development points at a scratch database; never let it charge
        // wallets, suspend servers or issue invoices.
        if (process.env.DISABLE_BILLING === 'true') {
            console.log('⏸️  DISABLE_BILLING=true — billing and suspension jobs are not scheduled.');
            return;
        }

        // Prepaid monthly billing (utils/monthlyBilling.js): renewals on the
        // 1st at 00:00 India time, and every 15 minutes the overdue timeline
        // (late fee, suspension, deletion), balance payments and cancelled
        // plans ending. The old hourly balance deductions are gone.
        cron.schedule('0 0 1 * *', () => {
            console.log('📅 Issuing monthly invoices...');
            monthlyBilling.run().then(() => autoTopup.run());
        }, { timezone: 'Asia/Kolkata' });
        cron.schedule('*/15 * * * *', () => monthlyBilling.run().then(() => autoTopup.run()));
    }
}

module.exports = new BillingService();
