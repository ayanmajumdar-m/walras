const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Transactional email over SMTP (Brevo's relay).
 *
 * This used to go through Brevo's HTTP API with an `xkeysib-` API key. It now
 * uses SMTP with an `xsmtpsib-` key — one credential to rotate, one place for
 * deliverability to be right or wrong.
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
const FROM_ADDR = process.env.MAIL_FROM_ADDR || 'noreply@walras.net';

/**
 * The sender for every outgoing email. An admin can override the name and
 * address from the admin dashboard (stored in app_settings); otherwise the
 * MAIL_FROM_NAME / MAIL_FROM_ADDR environment values apply. The address must
 * be on a domain verified in Brevo, or Brevo will reject the message.
 */
const resolveSender = async () => {
    try {
        // Required lazily: appSettings pulls in the DB connection, which a
        // plain `require('./sendEmail')` (e.g. at boot) should not depend on.
        const settings = await require('./appSettings').getAll();
        return {
            name: settings.mail_from_name || FROM_NAME,
            address: settings.mail_from_addr || FROM_ADDR,
        };
    } catch (err) {
        console.error('Could not read sender settings, using environment defaults:', err.message);
        return { name: FROM_NAME, address: FROM_ADDR };
    }
};

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


const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const AUTH_CODE_COPY = {
    verify: {
        subject: 'Your Walras Cloud verification code',
        heading: 'Verify your email',
        intro: 'Thanks for signing up for Walras Cloud. Enter this code to confirm your email address:',
    },
    reset: {
        subject: 'Your Walras Cloud password reset code',
        heading: 'Reset your password',
        intro: 'We received a request to reset your Walras Cloud password. Enter this code to choose a new one:',
    },
};

// Table layout and inline styles: email clients ignore most <style> blocks.
const createAuthCodeTemplate = (name, code, purpose, minutes) => {
    const copy = AUTH_CODE_COPY[purpose];
    return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f2f3;font-family:Arial,Helvetica,sans-serif;color:#1d1f20;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f3;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e5e4;">
          <tr><td style="background:#0b2622;padding:22px 28px;">
            <span style="font-size:18px;font-weight:700;letter-spacing:0.08em;color:#ffffff;">WALRAS CLOUD</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:22px;">${copy.heading}</h1>
            <p style="margin:0 0 6px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name)},</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">${copy.intro}</p>
            <div style="margin:0 0 22px;padding:18px;text-align:center;background:#e8fbf5;border:1px solid #c6f4e6;border-radius:10px;">
              <span style="font-size:32px;font-weight:700;letter-spacing:0.35em;color:#037566;font-family:'Courier New',monospace;">${code}</span>
            </div>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#5d5d60;">This code expires in ${minutes} minutes.</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#5d5d60;">If you didn't request this, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e3e5e4;font-size:12px;color:#7a7a7d;">
            &copy; ${new Date().getFullYear()} Walras Cloud. This is an automated message; please do not reply.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

/**
 * Sends a sign-up verification or password-reset code. Throws if mail is not
 * configured or the relay rejects it, so the caller can tell the user the
 * code was not sent instead of leaving them waiting for an email.
 */
const sendAuthCodeEmail = async (to, name, code, purpose, minutes) => {
    // Local testing only: Brevo refuses relays from IPs not on its allowlist,
    // so print the code instead. Ignored in production.
    if (process.env.MAIL_DEV_LOG === 'true' && process.env.NODE_ENV !== 'production') {
        console.log(`📧 [MAIL_DEV_LOG] ${purpose} code for ${to}: ${code} (valid ${minutes} min)`);
        return { messageId: 'dev-log' };
    }
    if (!emailConfigured) {
        throw new Error('Email is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS)');
    }
    const copy = AUTH_CODE_COPY[purpose];
    const info = await transporter.sendMail({
        from: await resolveSender(),
        to,
        subject: copy.subject,
        text: `${copy.intro}

${code}

This code expires in ${minutes} minutes. If you didn't request this, ignore this email.`,
        html: createAuthCodeTemplate(name, code, purpose, minutes),
    });
    console.log(`Auth code email (${purpose}) sent:`, info.messageId);
    return info;
};

const sendDomainPurchaseEmail = async (to, name, domainName, purchaseDate) => {
    if (!emailConfigured) {
        console.warn(`Email disabled — not sending domain purchase confirmation to ${to}`);
        return;
    }

    const message = {
        from: await resolveSender(),
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

/**
 * Sends a short test message with the current sender, so an admin can confirm
 * a new sender address is accepted by Brevo before customers depend on it.
 */
const sendTestEmail = async (to) => {
    if (!emailConfigured) throw new Error('Email is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS)');
    const from = await resolveSender();
    const info = await transporter.sendMail({
        from,
        to,
        subject: 'Walras Cloud test email',
        text: `This is a test email from Walras Cloud.

Sender: ${from.name} <${from.address}>

If you received this, the sender settings work.`,
    });
    return { messageId: info.messageId, from };
};

module.exports = {
    resolveSender,
    sendTestEmail,
    sendAuthCodeEmail,
    sendDomainPurchaseEmail,
    verifyEmailTransport,
};
