const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Transactional email over SMTP (Brevo's relay).
 *
 * This used to go through Brevo's HTTP API with an `xkeysib-` API key. It now
 * uses SMTP with an `xsmtpsib-` key, so Walras Cloud and BUTTR ID authenticate
 * to the same relay with the same credentials — one thing to rotate, one place
 * for deliverability to be right or wrong.
 *
 * Missing credentials do not stop the server. They used to call process.exit(1)
 * at import time, which killed Express before it bound a port and looked like a
 * crash-loop with no explanation. Now mail simply no-ops with a warning.
 */
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const FROM_NAME = process.env.MAIL_FROM_NAME || 'Walras Cloud';
const FROM_ADDR = process.env.MAIL_FROM_ADDR || 'yours@buttrcrew.com';

const emailConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

if (!emailConfigured) {
    console.warn('⚠️  SMTP_HOST / SMTP_USER / SMTP_PASS not set — transactional email is disabled.');
}

// Port 587 is STARTTLS: the connection opens in the clear and is upgraded, so
// `secure` is false here and true only for implicit TLS on 465. Getting this
// backwards is the classic "greeting never received" hang.
const transporter = emailConfigured
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
    : null;

/**
 * Confirms the relay is reachable and the credentials are accepted, without
 * sending anything. Called at boot so a misconfiguration is visible in the logs
 * rather than discovered by the first customer who buys a domain.
 */
const verifyEmailTransport = async () => {
    if (!transporter) return false;
    try {
        await transporter.verify();
        console.log(`✅ SMTP ready (${SMTP_USER} via ${SMTP_HOST}:${SMTP_PORT})`);
        return true;
    } catch (error) {
        console.error('⚠️  SMTP verification failed:', error.message);
        if (/unauthorized ip/i.test(error.message)) {
            console.error("   Brevo restricts the relay to allowlisted IPs. Add this server's" +
                ' public IP under Brevo → Security → Authorised IPs.');
        }
        return false;
    }
};

const createDomainPurchaseTemplate = (name, domainName, purchaseDate) => {
    return `
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Domain Purchase Confirmation</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${name},</h2>
                        <p>Thank you for purchasing a domain with Walras Cloud!</p>
                        <p>Here are the details of your purchase:</p>
                        <ul>
                            <li><strong>Domain Name:</strong> ${domainName}</li>
                            <li><strong>Purchase Date:</strong> ${purchaseDate}</li>
                        </ul>
                        <p>If you have any questions or need further assistance, please feel free to reach out to our support team.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} Walras Cloud. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};


// The welcome-with-OTP and password-reset emails left with the local auth
// system. BUTTR ID sends its own verification and recovery mail.

const sendDomainPurchaseEmail = async (to, name, domainName, purchaseDate) => {
    if (!emailConfigured) {
        console.warn(`Email disabled — not sending domain purchase confirmation to ${to}`);
        return;
    }

    const message = {
        from: { name: FROM_NAME, address: FROM_ADDR },
        to,
        subject: 'Domain Purchase Confirmation',
        html: createDomainPurchaseTemplate(name, domainName, purchaseDate),
    };

    try {
        const info = await transporter.sendMail(message);
        console.log('Domain purchase email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending domain purchase email:', error.message);
        throw error;
    }
};

module.exports = {
    sendDomainPurchaseEmail,
    verifyEmailTransport,
};
