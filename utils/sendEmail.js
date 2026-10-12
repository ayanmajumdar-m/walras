const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Transactional email through Brevo, by one of two transports:
 *   - Brevo's email API (https://api.brevo.com/v3/smtp/email) with an
 *     `xkeysib-` API key, when BREVO_API_KEY is set. Used first.
 *   - SMTP (Brevo's relay, smtp-relay.brevo.com) with an `xsmtpsib-` SMTP key
 *     (SMTP_HOST / SMTP_USER / SMTP_PASS), otherwise.
 * Both look the same to the rest of this file: sendMail(message) and verify().
 * Brevo's "Authorised IPs" security setting applies to both.
 *
 * Missing credentials do not stop the server. They used to call process.exit(1)
 * at import time, which killed Express before it bound a port and looked like a
 * crash-loop with no explanation. Now mail simply no-ops with a warning.
 */
// Settings come from Admin → Integrations (stored encrypted), falling back to the env.
const integrations = require('./integrations');
const smtp = () => ({
    host: integrations.get('SMTP_HOST'),
    port: Number(integrations.get('SMTP_PORT')) || 587,
    user: integrations.get('SMTP_USER'),
    pass: integrations.get('SMTP_PASS'),
});

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

// Port 587 is STARTTLS: the connection opens in the clear and is upgraded, so
// `secure` is false here and true only for implicit TLS on 465. Getting this
// backwards is the classic "greeting never received" hang.
// The transport is rebuilt whenever the SMTP settings change.
let transport = null; // { key, transporter }

const BREVO_API = 'https://api.brevo.com/v3';

/** The Brevo API key: an `xkeysib-` key, or Brevo's MCP token (base64 JSON with api_key) that wraps one. */
const brevoApiKey = () => {
    const raw = String(integrations.get('BREVO_API_KEY') || '').trim();
    if (!raw || raw.startsWith('xkeysib-')) return raw;
    try {
        const inner = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')).api_key;
        return typeof inner === 'string' ? inner.trim() : raw;
    } catch {
        return raw;
    }
};

/** "Name <a@b>" / { name, address } / "a@b" → Brevo's { email, name }. */
const brevoAddress = (v) => {
    if (v && typeof v === 'object') return { email: v.address || v.email, ...(v.name ? { name: v.name } : {}) };
    const m = String(v).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    return m ? { email: m[2].trim(), ...(m[1].trim() ? { name: m[1].trim() } : {}) } : { email: String(v).trim() };
};

/** A transporter with nodemailer's shape that sends through Brevo's email API. */
const brevoTransporter = (apiKey) => {
    const call = async (path, init = {}) => {
        const res = await fetch(`${BREVO_API}${path}`, {
            ...init,
            headers: { 'api-key': apiKey, accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) },
            signal: AbortSignal.timeout(20000),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(`Brevo API ${res.status}: ${body.message || body.code || res.statusText}`);
            err.status = res.status;
            throw err;
        }
        return body;
    };
    return {
        sendMail: async ({ from, to, subject, html, text, headers }) => {
            const out = await call('/smtp/email', {
                method: 'POST',
                body: JSON.stringify({
                    sender: brevoAddress(from),
                    to: (Array.isArray(to) ? to : String(to).split(',')).filter(Boolean).map(brevoAddress),
                    subject,
                    ...(html ? { htmlContent: html } : {}),
                    ...(text ? { textContent: text } : {}),
                    ...(headers && Object.keys(headers).length ? { headers } : {}),
                }),
            });
            return { messageId: out.messageId || out.messageIds?.[0] || 'brevo-api' };
        },
        // The account endpoint checks the key (and Brevo's IP allowlist) without sending.
        verify: async () => { await call('/account'); return true; },
    };
};

const getTransporter = () => {
    const apiKey = brevoApiKey();
    if (apiKey) {
        const key = `api:${apiKey}`;
        if (!transport || transport.key !== key) transport = { key, transporter: brevoTransporter(apiKey), via: 'Brevo API' };
        return transport.transporter;
    }
    const s = smtp();
    if (!(s.host && s.user && s.pass)) return null;
    const key = JSON.stringify(s);
    if (!transport || transport.key !== key) {
        transport = {
            key,
            transporter: nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, auth: { user: s.user, pass: s.pass } }),
            via: 'SMTP',
        };
    }
    return transport.transporter;
};
const isEmailConfigured = () => Boolean(getTransporter());

/**
 * Confirms the relay is reachable and the credentials are accepted, without
 * sending anything. Called at boot so a misconfiguration is visible in the logs
 * rather than discovered by the first customer who buys a domain.
 */
const verifyEmailTransport = async () => {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn('⚠️  Email isn\'t set up (BREVO_API_KEY, or SMTP_HOST / SMTP_USER / SMTP_PASS) — email is disabled.');
        return false;
    }
    try {
        await transporter.verify();
        if (transport?.via === 'Brevo API') console.log('✅ Email ready (Brevo API)');
        else { const s = smtp(); console.log(`✅ SMTP ready (${s.user} via ${s.host}:${s.port})`); }
        return true;
    } catch (error) {
        console.error(`⚠️  Email (${transport?.via || 'SMTP'}) verification failed:`, error.message);
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
    if (!isEmailConfigured()) {
        throw new Error('Email is not configured (set BREVO_API_KEY, or SMTP_HOST, SMTP_USER and SMTP_PASS, in the server environment)');
    }
    const copy = AUTH_CODE_COPY[purpose];
    const info = await getTransporter().sendMail({
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
    if (!isEmailConfigured()) {
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
        const info = await getTransporter().sendMail(message);
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
    if (!isEmailConfigured()) throw new Error('Email is not configured (set BREVO_API_KEY, or SMTP_HOST, SMTP_USER and SMTP_PASS, in the server environment)');
    const from = await resolveSender();
    const info = await getTransporter().sendMail({
        from,
        to,
        subject: 'Walras Cloud test email',
        text: `This is a test email from Walras Cloud.

Sender: ${from.name} <${from.address}>

If you received this, the sender settings work.`,
    });
    return { messageId: info.messageId, from };
};

/**
 * Tells someone they've been invited to a Walras Cloud account. There is no
 * link token: they accept in the console after signing in (or signing up)
 * with this email address, which is what proves the invite is theirs.
 */
const sendTeamInviteEmail = async (to, ownerName, accessLabels) => {
    const base = (require('./integrations').get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '');
    const acceptUrl = `${base}/dashboard/profile?tab=team`;
    const signupUrl = `${base}/signup`;
    const access = accessLabels.join(', ');
    if (process.env.MAIL_DEV_LOG === 'true' && process.env.NODE_ENV !== 'production') {
        console.log(`📧 [MAIL_DEV_LOG] team invite for ${to} from ${ownerName} (${access})`);
        return { messageId: 'dev-log' };
    }
    if (!isEmailConfigured()) throw new Error('Email is not configured (set BREVO_API_KEY, or SMTP_HOST, SMTP_USER and SMTP_PASS, in the server environment)');
    const info = await getTransporter().sendMail({
        from: await resolveSender(),
        to,
        subject: `${ownerName} invited you to their Walras Cloud account`,
        text: `${ownerName} invited you to their Walras Cloud account with access to: ${access}.

To accept, sign in with this email address and open Account > Team:
${acceptUrl}

New to Walras Cloud? Create an account with this email address first:
${signupUrl}

If you weren't expecting this, you can ignore this email.`,
        html: `
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
            <h1 style="margin:0 0 12px;font-size:22px;">You've been invited to a team</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;"><strong>${escapeHtml(ownerName)}</strong> invited you to their Walras Cloud account.</p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">Your access: <strong>${escapeHtml(access)}</strong></p>
            <p style="margin:0 0 22px;"><a href="${acceptUrl}" style="display:inline-block;padding:12px 22px;background:#1fc3a0;color:#0a0a0c;font-weight:700;text-decoration:none;border-radius:10px;">Sign in to accept</a></p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#5d5d60;">Sign in with this email address (${escapeHtml(to)}). New to Walras Cloud? <a href="${signupUrl}" style="color:#037566;">Create an account</a> with this address first.</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#5d5d60;">If you weren't expecting this, you can ignore this email.</p>
          </td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e3e5e4;font-size:12px;color:#7a7a7d;">
            &copy; ${new Date().getFullYear()} Walras Cloud. This is an automated message; please do not reply.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    });
    console.log('Team invite email sent:', info.messageId);
    return info;
};

/** One prepared message (bulk email). Throws so the caller can count failures. */
const sendRawEmail = async ({ to, subject, html, text, headers }) => {
    if (process.env.MAIL_DEV_LOG === 'true' && process.env.NODE_ENV !== 'production') {
        console.log(`📧 [MAIL_DEV_LOG] "${subject}" to ${to}`);
        return { messageId: 'dev-log' };
    }
    if (!isEmailConfigured()) throw new Error('Email is not configured (set BREVO_API_KEY, or SMTP_HOST, SMTP_USER and SMTP_PASS, in the server environment)');
    return getTransporter().sendMail({ from: await resolveSender(), to, subject, html, text, headers });
};

module.exports = {
    sendRawEmail,
    isEmailConfigured,
    escapeHtml,
    sendTeamInviteEmail,
    resolveSender,
    sendTestEmail,
    sendAuthCodeEmail,
    sendDomainPurchaseEmail,
    verifyEmailTransport,
};
