/**
 * Bulk email to customers, from the admin panel.
 *
 * One campaign sends at a time, in the background, a few messages a second
 * so the relay (Brevo) doesn't throttle us. Progress lives in bulk_emails;
 * recipients are walked in user-id order and last_user_id is saved after
 * each one, so a campaign stopped by a restart can be resumed exactly where
 * it left off without emailing anyone twice.
 *
 * Who receives it:
 *   - only verified email addresses, never suspended accounts;
 *   - "News & offers" skips customers who unsubscribed and carries an
 *     unsubscribe link (and List-Unsubscribe headers);
 *   - "Service announcement" (maintenance, policy changes) goes to everyone
 *     in the audience, as account email.
 */
const crypto = require('crypto');
const connection = require('../config/db');
const { sendRawEmail, escapeHtml } = require('../utils/sendEmail');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const CATEGORIES = {
    announcement: { label: 'Service announcement', desc: 'Account and service news, e.g. maintenance or policy changes. Sent to everyone in the audience.' },
    marketing: { label: 'News & offers', desc: 'Product news and promotions. Skips customers who unsubscribed and includes an unsubscribe link.' },
};

// SQL fragments only from this fixed list, never from input.
const AUDIENCES = {
    all: { label: 'All customers', where: 'TRUE' },
    active: {
        label: 'Customers with active services',
        where: `(EXISTS (SELECT 1 FROM servers s WHERE s.user_id = u.id AND s.status IN ('active', 'stopped', 'deploying'))
                 OR EXISTS (SELECT 1 FROM hosting_accounts h WHERE h.user_id = u.id AND h.status = 'active'))`,
    },
    business: { label: 'Business accounts', where: "u.account_type = 'business'" },
    personal: { label: 'Personal accounts', where: "u.account_type = 'personal'" },
    // One chosen customer (target_user_id). Reaches them whatever their
    // verification or suspension, so an admin can always write to that
    // person; "News & offers" still respects their unsubscribe.
    single: { label: 'A specific customer', single: true },
};

const DELAY_MS = 150; // ≈ 6 a second
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// targetUserId is only used for "single" and is checked to be an integer, so
// it is safe to place in the SQL; everything else comes from AUDIENCES.
const recipientsWhere = (audience, category, targetUserId) => {
    const single = AUDIENCES[audience].single;
    if (single && !(Number.isInteger(targetUserId) && targetUserId > 0)) return 'FALSE';
    return [
        ...(single ? [] : ['u.isemailverified = TRUE', 'u.suspended_at IS NULL']),
        "u.email IS NOT NULL AND u.email <> ''",
        ...(category === 'marketing' ? ['u.marketing_opt_out = FALSE'] : []),
        single ? `u.id = ${targetUserId}` : AUDIENCES[audience].where,
    ].join(' AND ');
};

const countRecipients = async (audience, category, targetUserId) => {
    const [{ n }] = await q(`SELECT COUNT(*) AS n FROM users u WHERE ${recipientsWhere(audience, category, targetUserId)}`);
    return Number(n);
};

/** Customers matching a name or email, for picking one recipient. */
const findCustomers = (term) => {
    const like = `%${String(term).toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return q(
        `SELECT id, waladmin_id, name, email, isemailverified, suspended_at, marketing_opt_out FROM users
         WHERE LOWER(email) LIKE ? OR LOWER(name) LIKE ? OR LOWER(waladmin_id) LIKE ? ORDER BY name LIMIT 8`,
        [like, like, like],
    );
};

// ── Unsubscribe links ──────────────────────────────────────────────────────

const unsubscribeToken = (userId) =>
    crypto.createHmac('sha256', process.env.JWT_SECRET || 'walras').update(`unsubscribe:${userId}`).digest('base64url');

const checkUnsubscribeToken = (userId, token) => {
    const expected = Buffer.from(unsubscribeToken(userId));
    const given = Buffer.from(String(token || ''));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

// The site and API share one origin (CLIENT_URL); API_URL may still name the old host.
const apiBase = () => (require('../utils/integrations').get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '');
const unsubscribeUrl = (userId) => `${apiBase()}/api/email/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;

// ── Message ────────────────────────────────────────────────────────────────

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// Plain text in, safe HTML out: escaped, blank lines become paragraphs, links clickable.
const bodyToHtml = (body) => escapeHtml(body)
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${para
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" style="color:#037566;">$1</a>')}</p>`)
    .join('');

const personalise = (text, user) => String(text).replace(/\{\{\s*name\s*\}\}/gi, firstName(user.name));

const buildMessage = ({ subject, body, category }, user) => {
    const text = personalise(body, user);
    const unsub = category === 'marketing' ? unsubscribeUrl(user.id) : null;
    const footer = unsub
        ? `You're receiving this because you have a Walras Cloud account. <a href="${unsub}" style="color:#7a7a7d;">Unsubscribe from news and offers</a>.`
        : "You're receiving this service announcement because you have a Walras Cloud account.";
    const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f2f3;font-family:Arial,Helvetica,sans-serif;color:#1d1f20;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f3;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e5e4;">
          <tr><td style="background:#0b2622;padding:22px 28px;">
            <span style="font-size:18px;font-weight:700;letter-spacing:0.08em;color:#ffffff;">WALRAS CLOUD</span>
          </td></tr>
          <tr><td style="padding:28px 28px 14px;">${bodyToHtml(text)}</td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e3e5e4;font-size:12px;line-height:1.6;color:#7a7a7d;">
            ${footer}<br>&copy; ${new Date().getFullYear()} Walras Cloud
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
    return {
        to: user.email,
        subject: personalise(subject, user),
        html,
        text: `${text}\n\n--\n${unsub ? `Unsubscribe from news and offers: ${unsub}` : "You're receiving this because you have a Walras Cloud account."}`,
        headers: unsub ? { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {},
    };
};

// ── Campaigns ──────────────────────────────────────────────────────────────

let running = null; // id of the campaign this process is sending

const run = async (id) => {
    running = id;
    try {
        for (;;) {
            const [c] = await q('SELECT * FROM bulk_emails WHERE id = ?', [id]);
            if (!c || c.status !== 'sending') return;
            const batch = await q(
                `SELECT u.id, u.name, u.email FROM users u
                 WHERE ${recipientsWhere(c.audience, c.category, c.target_user_id)} AND u.id > ?
                 ORDER BY u.id LIMIT 25`,
                [c.last_user_id],
            );
            if (!batch.length) {
                await q("UPDATE bulk_emails SET status = 'sent', finished_at = NOW() WHERE id = ? AND status = 'sending'", [id]);
                console.log(`📣 Bulk email ${id} finished`);
                return;
            }
            for (const user of batch) {
                // Stop promptly if an admin cancelled.
                const [now] = await q('SELECT status FROM bulk_emails WHERE id = ?', [id]);
                if (now?.status !== 'sending') return;
                let ok = true;
                try {
                    await sendRawEmail(buildMessage(c, user));
                } catch (err) {
                    ok = false;
                    console.warn(`Bulk email ${id} to user ${user.id} failed:`, err.message);
                    await q('UPDATE bulk_emails SET last_error = ? WHERE id = ?', [String(err.message).slice(0, 300), id]).catch(() => {});
                }
                await q(
                    `UPDATE bulk_emails SET last_user_id = ?, ${ok ? 'sent = sent + 1' : 'failed = failed + 1'} WHERE id = ?`,
                    [user.id, id],
                );
                await sleep(DELAY_MS);
            }
        }
    } catch (err) {
        console.error(`Bulk email ${id} stopped:`, err.message);
        await q("UPDATE bulk_emails SET status = 'interrupted', last_error = ? WHERE id = ? AND status = 'sending'",
            [String(err.message).slice(0, 300), id]).catch(() => {});
    } finally {
        running = null;
    }
};

const isBusy = async () => {
    const [row] = await q("SELECT id FROM bulk_emails WHERE status = 'sending' LIMIT 1");
    return row ? row.id : null;
};

/** Starts a campaign. Returns its id. */
const start = async ({ subject, body, category, audience, targetUserId, admin }) => {
    const target = AUDIENCES[audience].single ? targetUserId : null;
    const total = await countRecipients(audience, category, target);
    const ins = await q(
        `INSERT INTO bulk_emails (subject, body, category, audience, target_user_id, status, total, created_by, created_by_name)
         VALUES (?, ?, ?, ?, ?, 'sending', ?, ?, ?)`,
        [subject, body, category, audience, target, total, admin.id, admin.name],
    );
    setImmediate(() => run(ins.insertId));
    return { id: ins.insertId, total };
};

const resume = async (id) => {
    const r = await q("UPDATE bulk_emails SET status = 'sending', finished_at = NULL WHERE id = ? AND status = 'interrupted'", [id]);
    // If this process's loop for it hasn't wound down yet, it carries on by itself.
    if (r.affectedRows && running !== id) setImmediate(() => run(id));
    return Boolean(r.affectedRows);
};

const cancel = async (id) => {
    const r = await q("UPDATE bulk_emails SET status = 'cancelled', finished_at = NOW() WHERE id = ? AND status IN ('sending', 'interrupted')", [id]);
    return Boolean(r.affectedRows);
};

/** At boot: a campaign left "sending" by a restart can't still be running. */
const markInterrupted = () =>
    q("UPDATE bulk_emails SET status = 'interrupted' WHERE status = 'sending'")
        .then((r) => { if (r.affectedRows) console.log(`📣 ${r.affectedRows} bulk email(s) marked interrupted; resume them from the admin panel.`); })
        .catch(() => {});

const sendTest = (to, campaign, adminName) =>
    sendRawEmail(buildMessage({ ...campaign, subject: `[Test] ${campaign.subject}` }, { id: 0, name: adminName, email: to }));

module.exports = {
    CATEGORIES,
    AUDIENCES,
    countRecipients,
    findCustomers,
    start,
    resume,
    cancel,
    isBusy,
    markInterrupted,
    sendTest,
    checkUnsubscribeToken,
    isRunningHere: (id) => running === id,
};
