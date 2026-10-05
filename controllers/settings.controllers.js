const appSettings = require('../utils/appSettings');
const { resolveSender, sendTestEmail } = require('../utils/sendEmail');
const { validateEmail } = require('../utils/validation');

/**
 * Admin settings for outgoing email. Owner-only (see routes/admin.routes.js).
 */
const SettingsController = {
    // GET /api/admin/settings/mail
    getMail: async (req, res) => {
        try {
            const settings = await appSettings.getAll();
            const effective = await resolveSender();
            res.json({
                fromName: settings.mail_from_name || '',
                fromAddress: settings.mail_from_addr || '',
                effective,
                defaults: {
                    fromName: process.env.MAIL_FROM_NAME || 'Walras Cloud',
                    fromAddress: process.env.MAIL_FROM_ADDR || 'noreply@walras.net',
                },
            });
        } catch (err) {
            console.error('Get mail settings failed:', err.message);
            res.status(500).json({ error: 'Could not load email settings' });
        }
    },

    // PUT /api/admin/settings/mail  { fromName, fromAddress }
    // Empty values clear the override and fall back to the environment.
    updateMail: async (req, res) => {
        const fromName = typeof req.body.fromName === 'string' ? req.body.fromName.trim() : '';
        const fromAddress = typeof req.body.fromAddress === 'string' ? req.body.fromAddress.trim().toLowerCase() : '';

        if (fromName.length > 100 || /[\r\n<>"]/.test(fromName)) {
            return res.status(400).json({ error: 'Sender name must be at most 100 characters, without line breaks, quotes or < >' });
        }
        if (fromAddress && !validateEmail(fromAddress)) {
            return res.status(400).json({ error: 'Enter a valid sender email address' });
        }

        try {
            await appSettings.setMany({ mail_from_name: fromName, mail_from_addr: fromAddress });
            res.json({ message: 'Email sender updated', effective: await resolveSender() });
        } catch (err) {
            console.error('Update mail settings failed:', err.message);
            res.status(500).json({ error: 'Could not save email settings' });
        }
    },

    // POST /api/admin/settings/mail/test  { to }
    testMail: async (req, res) => {
        const to = typeof req.body.to === 'string' ? req.body.to.trim() : '';
        if (!validateEmail(to)) return res.status(400).json({ error: 'Enter a valid email address to send the test to' });
        try {
            const { from } = await sendTestEmail(to);
            res.json({ message: `Test email sent to ${to} from ${from.address}` });
        } catch (err) {
            console.error('Test email failed:', err.message);
            res.status(502).json({ error: `Brevo rejected the test email: ${err.message}` });
        }
    },
};

module.exports = SettingsController;
