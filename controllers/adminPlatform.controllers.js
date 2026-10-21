/**
 * Admin governance and operations: administrators and roles, audit logs,
 * platform settings, customer detail/suspension/wallet adjustments, orders
 * and notifications. Routes are in routes/admin.routes.js.
 */

const bcrypt = require('bcrypt');
const connection = require('../config/db');
const audit = require('../utils/audit');
const rbac = require('../utils/adminRbac');
const platform = require('../utils/platformSettings');
const { forgetUserStatus } = require('../utils/auth.middleware');
const zendesk = require('../services/zendesk');
const supportDepartments = require('../utils/supportDepartments');
const solusAccounts = require('../utils/solusAccounts');
const computeStock = require('../utils/computeStock');
const serverLocations = require('../utils/serverLocations');
const { ensureWallet } = require('../utils/wallets');
const supportPlus = require('../utils/supportPlus');
const kyc = require('../utils/kyc');
const { sendRawEmail, escapeHtml } = require('../utils/sendEmail');
const integrations = require('../utils/integrations');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Async handler wrapper: HttpErrors become JSON, anything else a logged 500.
const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That already exists' });
        console.error(`Admin ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

const toInt = (v) => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Invalid id');
    return n;
};

const passwordProblem = (pw) => {
    if (typeof pw !== 'string' || pw.length < 10) return 'Admin passwords must be at least 10 characters';
    if (Buffer.byteLength(pw, 'utf8') > 72) return 'Password must be at most 72 characters';
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain a letter and a number';
    return null;
};

const activeSuperAdmins = async () =>
    Number((await q("SELECT COUNT(*) AS n FROM admins WHERE role = 'super_admin' AND is_active = true"))[0].n);

// Tells the customer their KYC was verified, or why it wasn't. Never fails the request.
const emailKyc = async (user, status, note) => {
    try {
        const url = `${(integrations.get('CLIENT_URL') || 'https://www.walras.net').replace(/\/+$/, '')}/dashboard/profile?tab=kyc`;
        const lines = status === 'verified'
            ? ['Your KYC verification is complete. Every Walras Cloud service is now unlocked in your console.']
            : ["We couldn't verify your KYC documents.", `Reason: ${note}`, 'Please send your documents again from the console.'];
        const subject = status === 'verified' ? 'Your KYC is verified' : 'Your KYC needs another look';
        const text = [`Hi ${user.name || 'there'},`, '', ...lines, '', `KYC verification: ${url}`, '', 'Walras Cloud'].join('\n');
        const html = `<p>Hi ${escapeHtml(user.name || 'there')},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}`
            + `<p><a href="${escapeHtml(url)}">Open KYC verification</a></p><p>Walras Cloud</p>`;
        await sendRawEmail({ to: user.email, subject, text, html });
    } catch (err) {
        console.warn(`KYC email to user ${user.id} failed:`, err.message);
    }
};

const PlatformController = {
    // ── Me ───────────────────────────────────────────────────────────────
    me: (req, res) => {
        res.json({
            id: req.admin.adminId,
            username: req.admin.username,
            fullName: req.admin.fullName,
            role: req.admin.role,
            permissions: req.admin.permissions,
        });
    },

    // ── Administrators ───────────────────────────────────────────────────
    listAdmins: handle(async (req, res) => {
        const admins = await q(
            `SELECT id, username, full_name, role, is_active, last_login_at, created_at
             FROM admins ORDER BY created_at ASC`
        );
        res.json({ admins, roles: rbac.ROLES });
    }),

    createAdmin: handle(async (req, res) => {
        const username = String(req.body.username || '').trim().toLowerCase();
        const fullName = String(req.body.fullName || '').trim();
        const { password, role } = req.body;

        if (!/^[a-z0-9._-]{3,50}$/.test(username)) throw new HttpError(400, 'Username: 3 to 50 letters, numbers, dots, dashes or underscores');
        if (!rbac.isRole(role)) throw new HttpError(400, 'Choose a role');
        if (role === 'super_admin' && req.admin.role !== 'super_admin') throw new HttpError(403, 'Only a super admin can create super admins');
        const problem = passwordProblem(password);
        if (problem) throw new HttpError(400, problem);

        // access is the pre-roles column; keep it consistent for old code paths.
        const access = role === 'super_admin' ? 'owner' : 'billing';
        const result = await q(
            'INSERT INTO admins (username, full_name, password, role, access) VALUES (?, ?, ?, ?, ?)',
            [username, fullName || null, await bcrypt.hash(password, 12), role, access]
        );
        audit(req, 'admin.create', 'admin', result.insertId, { username, role });
        res.status(201).json({ message: 'Administrator created', id: result.insertId });
    }),

    updateAdmin: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const [target] = await q('SELECT id, username, role, is_active FROM admins WHERE id = ?', [id]);
        if (!target) throw new HttpError(404, 'Administrator not found');

        const role = req.body.role !== undefined ? req.body.role : target.role;
        const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : target.is_active;
        const fullName = req.body.fullName !== undefined ? String(req.body.fullName).trim().slice(0, 100) : undefined;

        if (!rbac.isRole(role)) throw new HttpError(400, 'Unknown role');
        const touchesSuper = role === 'super_admin' || target.role === 'super_admin';
        if (touchesSuper && req.admin.role !== 'super_admin') throw new HttpError(403, 'Only a super admin can change super admins');
        if (id === req.admin.adminId && (role !== target.role || !isActive)) {
            throw new HttpError(400, "You can't change your own role or deactivate yourself");
        }
        if (target.role === 'super_admin' && target.is_active && (role !== 'super_admin' || !isActive) && (await activeSuperAdmins()) <= 1) {
            throw new HttpError(400, 'There must always be at least one active super admin');
        }

        await q(
            `UPDATE admins SET role = ?, is_active = ?, access = ?${fullName !== undefined ? ', full_name = ?' : ''} WHERE id = ?`,
            [role, isActive, role === 'super_admin' ? 'owner' : 'billing', ...(fullName !== undefined ? [fullName] : []), id]
        );
        audit(req, 'admin.update', 'admin', id, { username: target.username, role, isActive, previousRole: target.role });
        res.json({ message: 'Administrator updated' });
    }),

    resetAdminPassword: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const [target] = await q('SELECT id, username, role FROM admins WHERE id = ?', [id]);
        if (!target) throw new HttpError(404, 'Administrator not found');
        if (target.role === 'super_admin' && req.admin.role !== 'super_admin' && id !== req.admin.adminId) {
            throw new HttpError(403, "Only a super admin can reset a super admin's password");
        }
        const problem = passwordProblem(req.body.password);
        if (problem) throw new HttpError(400, problem);

        await q('UPDATE admins SET password = ? WHERE id = ?', [await bcrypt.hash(req.body.password, 12), id]);
        audit(req, 'admin.reset_password', 'admin', id, { username: target.username });
        res.json({ message: 'Password updated' });
    }),

    deleteAdmin: handle(async (req, res) => {
        const id = toInt(req.params.id);
        if (id === req.admin.adminId) throw new HttpError(400, "You can't delete yourself");
        const [target] = await q('SELECT id, username, role, is_active FROM admins WHERE id = ?', [id]);
        if (!target) throw new HttpError(404, 'Administrator not found');
        if (target.role === 'super_admin') {
            if (req.admin.role !== 'super_admin') throw new HttpError(403, 'Only a super admin can delete super admins');
            if (target.is_active && (await activeSuperAdmins()) <= 1) throw new HttpError(400, 'There must always be at least one active super admin');
        }
        await q('DELETE FROM admins WHERE id = ?', [id]);
        audit(req, 'admin.delete', 'admin', id, { username: target.username, role: target.role });
        res.json({ message: 'Administrator deleted' });
    }),

    // ── Roles & permissions ──────────────────────────────────────────────
    getRoles: handle(async (req, res) => {
        res.json({ roles: rbac.ROLES, permissions: rbac.PERMISSIONS, matrix: await rbac.loadMatrix() });
    }),

    setRolePermission: handle(async (req, res) => {
        const { role } = req.params;
        const { permission, allowed } = req.body;
        try {
            await rbac.setPermission(role, permission, Boolean(allowed));
        } catch (e) {
            throw new HttpError(400, e.message);
        }
        audit(req, allowed ? 'role.grant' : 'role.revoke', 'role', role, { permission });
        res.json({ message: 'Permission updated', matrix: await rbac.loadMatrix() });
    }),

    // ── Audit logs ───────────────────────────────────────────────────────
    listAuditLogs: handle(async (req, res) => {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 50));
        const where = [];
        const params = [];
        if (req.query.action) { where.push('action LIKE ?'); params.push(`${String(req.query.action)}%`); }
        if (req.query.admin) { where.push('admin_username = ?'); params.push(String(req.query.admin)); }
        if (req.query.targetType) { where.push('target_type = ?'); params.push(String(req.query.targetType)); }
        if (req.query.targetId) { where.push('target_id = ?'); params.push(String(req.query.targetId)); }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [{ n }] = await q(`SELECT COUNT(*) AS n FROM admin_audit_logs ${clause}`, params);
        const logs = await q(
            `SELECT id, admin_id, admin_username, action, target_type, target_id, metadata, ip, created_at
             FROM admin_audit_logs ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );
        res.json({ logs, total: Number(n), page, limit });
    }),

    // ── Platform settings ────────────────────────────────────────────────
    getPlatformSettings: handle(async (req, res) => {
        res.json(await platform.getPlatform());
    }),

    updatePlatformSettings: handle(async (req, res) => {
        const before = await platform.getPlatform();
        const next = {
            maintenanceMode: req.body.maintenanceMode !== undefined ? Boolean(req.body.maintenanceMode) : before.maintenanceMode,
            paymentsPaused: req.body.paymentsPaused !== undefined ? Boolean(req.body.paymentsPaused) : before.paymentsPaused,
            topUpsPaused: req.body.topUpsPaused !== undefined ? Boolean(req.body.topUpsPaused) : before.topUpsPaused,
            autoTopupEnabled: req.body.autoTopupEnabled !== undefined ? Boolean(req.body.autoTopupEnabled) : before.autoTopupEnabled,
        };
        if (next.autoTopupEnabled && !before.autoTopupEnabled && !before.autoTopupReady) {
            throw new HttpError(409, "Auto top-up can't be turned on until Razorpay has enabled recurring payments on the account (RAZORPAY_RECURRING=enabled) and the Razorpay keys and webhook secret are set.");
        }
        await platform.setPlatform(next);
        audit(req, 'settings.platform', 'settings', 'platform', { before: { maintenanceMode: before.maintenanceMode, paymentsPaused: before.paymentsPaused, topUpsPaused: before.topUpsPaused, autoTopupEnabled: before.autoTopupEnabled }, after: next });
        res.json({ message: 'Platform settings saved', ...(await platform.getPlatform()) });
    }),

    updateInvoiceDetails: handle(async (req, res) => {
        const gstin = String(req.body.invoice?.gstin || '').trim().toUpperCase();
        if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
            throw new HttpError(400, 'Enter a valid 15-character GSTIN');
        }
        await platform.setInvoiceDetails({ ...req.body.invoice, gstin });
        audit(req, 'settings.invoice', 'settings', 'invoice');
        res.json({ message: 'Invoice details saved', ...(await platform.getPlatform()) });
    }),

    // ── Customers ────────────────────────────────────────────────────────
    getUserOverview: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const [user] = await q(
            `SELECT id, waladmin_id, account_type, name, email, phone, company, gstin, role, address,
                    isverified, isemailverified, suspended_at, suspension_reason,
                    kyc_status, kyc_submitted_at, kyc_ticket_id, kyc_reviewed_at, kyc_reviewed_by, kyc_note,
                    lastloginat, lastloginip, createdat
             FROM users WHERE id = ?`,
            [id]
        );
        if (!user) throw new HttpError(404, 'Customer not found');

        const settle = (p) => p.catch((e) => { console.error('User overview part failed:', e.message); return []; });
        const [wallet, servers, domains, transactions, invoices, sessions, dedicatedServers] = await Promise.all([
            settle(q('SELECT id, balance, currency, updated_at FROM wallets WHERE user_id = ?', [id])),
            settle(q('SELECT id, name, ip_address, plan_name, location, status, hourly_cost, created_at FROM servers WHERE user_id = ? ORDER BY created_at DESC', [id])),
            settle(q('SELECT id, full_domain, status, amount, currency, registration_date, expiration_date, created_at FROM domain_transactions WHERE user_id = ? ORDER BY created_at DESC', [id])),
            settle(q(`SELECT wt.id, wt.type, wt.amount, wt.description, wt.status, wt.reference_id, wt.created_at
                      FROM wallet_transactions wt JOIN wallets w ON wt.wallet_id = w.id
                      WHERE w.user_id = ? ORDER BY wt.created_at DESC LIMIT 50`, [id])),
            settle(q('SELECT id, invoice_number, billing_month, total_amount, status, generated_at, due_date FROM monthly_invoices WHERE user_id = ? ORDER BY generated_at DESC LIMIT 24', [id])),
            settle(q('SELECT ip_address, user_agent, login_time FROM user_sessions WHERE user_id = ? ORDER BY login_time DESC LIMIT 10', [id])),
            settle(q('SELECT id, title, location, monthly_price, status, created_at FROM dedicated_orders WHERE user_id = ? ORDER BY created_at DESC', [id])),
        ]);

        const agentUrl = zendesk.zendeskAgentUrl();
        res.json({
            user,
            kycTicketUrl: agentUrl && user.kyc_ticket_id ? `${agentUrl}/tickets/${user.kyc_ticket_id}` : null,
            wallet: wallet[0] || null,
            servers, domains, transactions, invoices, sessions, dedicatedServers,
        });
    }),

    suspendUser: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const reason = String(req.body.reason || '').trim().slice(0, 255);
        if (reason.length < 3) throw new HttpError(400, 'Give a reason for the suspension');
        const result = await q('UPDATE users SET suspended_at = NOW(), suspension_reason = ? WHERE id = ?', [reason, id]);
        if (!result.affectedRows) throw new HttpError(404, 'Customer not found');
        forgetUserStatus(id);
        audit(req, 'user.suspend', 'user', id, { reason });
        res.json({ message: 'Customer suspended' });
    }),

    unsuspendUser: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const result = await q('UPDATE users SET suspended_at = NULL, suspension_reason = NULL WHERE id = ?', [id]);
        if (!result.affectedRows) throw new HttpError(404, 'Customer not found');
        forgetUserStatus(id);
        audit(req, 'user.unsuspend', 'user', id);
        res.json({ message: 'Customer reinstated' });
    }),

    /**
     * KYC, set by hand once the documents on their KYC VERIFICATION ticket
     * are checked: verified unlocks the services that need KYC; rejected
     * (with a reason the customer sees) lets them send documents again;
     * unverified takes a verification back. The customer is emailed for
     * verified and rejected.
     */
    setKyc: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const status = ['verified', 'rejected', 'unverified'].includes(req.body.status) ? req.body.status : null;
        const note = String(req.body.note || '').trim().slice(0, 500);
        if (!status) throw new HttpError(400, 'Choose verified, rejected or unverified');
        if (status === 'rejected' && note.length < 3) throw new HttpError(400, 'Give a reason; the customer sees it and can send their documents again');
        const [admin] = await q('SELECT username, full_name FROM admins WHERE id = ?', [req.admin.adminId]);
        const updated = await q(
            `UPDATE users SET kyc_status = ?, kyc_note = ?, kyc_reviewed_at = NOW(), kyc_reviewed_by = ?
              WHERE id = ? RETURNING id, name, email`,
            [status, note || null, admin?.full_name || admin?.username || 'Admin', id]
        );
        const user = updated.rows?.[0];
        if (!user) throw new HttpError(404, 'Customer not found');
        audit(req, 'user.kyc', 'user', id, { status, note: note || undefined });
        if (status !== 'unverified') emailKyc(user, status, note);
        res.json({ message: status === 'verified' ? 'KYC verified: the customer can now order every service' : status === 'rejected' ? 'KYC rejected: the customer can send their documents again' : 'KYC set back to unverified' });
    }),

    // Settings → KYC: which services can't be ordered until KYC is verified.
    getKycSettings: handle(async (req, res) => {
        const required = await kyc.getRequired();
        res.json({ products: Object.entries(kyc.PRODUCTS).map(([id, label]) => ({ id, label, required: required.includes(id) })) });
    }),

    updateKycSettings: handle(async (req, res) => {
        const required = await kyc.setRequired(req.body.required);
        audit(req, 'settings.kyc', 'settings', 'kyc', { required });
        res.json({ products: Object.entries(kyc.PRODUCTS).map(([id, label]) => ({ id, label, required: required.includes(id) })) });
    }),

    /**
     * Credit or debit a customer's wallet. Amount is in rupees; stored in
     * paise. Debits never take the balance below zero.
     */
    adjustWallet: handle(async (req, res) => {
        const id = toInt(req.params.id);
        const type = req.body.type === 'debit' ? 'debit' : req.body.type === 'credit' ? 'credit' : null;
        const rupees = Number(req.body.amount);
        const reason = String(req.body.reason || '').trim().slice(0, 200);

        if (!type) throw new HttpError(400, 'Choose credit or debit');
        if (!Number.isFinite(rupees) || rupees <= 0 || rupees > 1000000) throw new HttpError(400, 'Enter an amount between ₹0.01 and ₹10,00,000');
        if (reason.length < 3) throw new HttpError(400, 'Give a reason; it is shown on the customer\'s transaction');
        const paise = Math.round(rupees * 100);

        const [user] = await q('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) throw new HttpError(404, 'Customer not found');

        const wallet = await ensureWallet(id);

        const updated = type === 'credit'
            ? await q('UPDATE wallets SET balance = balance + ? WHERE id = ? RETURNING balance', [paise, wallet.id])
            : await q('UPDATE wallets SET balance = balance - ? WHERE id = ? AND balance >= ? RETURNING balance', [paise, wallet.id, paise]);
        if (!updated.affectedRows) throw new HttpError(400, 'Insufficient balance for this debit');

        const description = `${type === 'credit' ? 'Credit' : 'Debit'} by Walras Cloud: ${reason}`;
        await q(
            `INSERT INTO wallet_transactions (wallet_id, type, amount, description, status, reference_id)
             VALUES (?, ?, ?, ?, 'completed', ?)`,
            [wallet.id, type, paise, description, `ADMIN_${req.admin.adminId}_${Date.now()}`]
        );

        const balance = Number(updated.rows[0].balance) / 100;
        audit(req, `wallet.${type}`, 'user', id, { amount: rupees, reason, balanceAfter: balance });
        res.json({ message: `Account balance ${type === 'credit' ? 'credited' : 'debited'}`, balance });
    }),

    // ── Orders ───────────────────────────────────────────────────────────
    listOrders: handle(async (req, res) => {
        const status = ['pending', 'completed', 'failed', 'cancelled'].includes(req.query.status) ? req.query.status : null;
        const limit = Math.min(500, Math.max(10, Number.parseInt(req.query.limit, 10) || 200));
        // Razorpay payments (payment_orders: top-ups, invoice payments, auto
        // top-up), plus CCAvenue orders from before the switch (CCA… references).
        const orders = await q(
            `SELECT wt.reference_id AS order_id, w.user_id, u.name AS user_name, u.email,
                    CASE po.purpose WHEN 'invoice' THEN 'Invoice payment' WHEN 'autotopup_setup' THEN 'Auto top-up setup'
                         WHEN 'autotopup_charge' THEN 'Auto top-up' WHEN 'topup' THEN 'Account balance top-up'
                         ELSE CASE WHEN wt.reference_id LIKE 'CCAI%' THEN 'Invoice payment (CCAvenue)' ELSE 'Account balance top-up (CCAvenue)' END END AS item,
                    wt.amount, wt.status, wt.razorpay_payment_id AS tracking_id, wt.created_at
               FROM wallet_transactions wt
               JOIN wallets w ON w.id = wt.wallet_id LEFT JOIN users u ON u.id = w.user_id
               LEFT JOIN payment_orders po ON po.order_id = wt.reference_id
              WHERE wt.type = 'credit' AND (po.order_id IS NOT NULL OR wt.reference_id LIKE 'CCA%')
              ${status ? 'AND wt.status = ?' : ''}
              ORDER BY wt.created_at DESC LIMIT ?`,
            status ? [status, limit] : [limit],
        );
        res.json({ orders });
    }),

    // ── Notifications ────────────────────────────────────────────────────
    /**
     * Derived from the data itself rather than a separate event table: recent
     * sign-ups and failed payments. "Unread" is anything newer
     * than when this admin last opened the bell.
     */
    listNotifications: handle(async (req, res) => {
        const settle = (p) => p.catch(() => []);
        const [signups, failedTopups, [me], callbacks, kycWaiting] = await Promise.all([
            settle(q(`SELECT id, name, email, account_type, createdat AS at FROM users
                      WHERE createdat > NOW() - INTERVAL '14 days' ORDER BY createdat DESC LIMIT 20`)),
            settle(q(`SELECT wt.reference_id, wt.amount, w.user_id, u.name, wt.created_at AS at
                      FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id LEFT JOIN users u ON u.id = w.user_id
                      WHERE wt.status = 'failed' AND wt.created_at > NOW() - INTERVAL '14 days'
                      ORDER BY wt.created_at DESC LIMIT 20`)),
            q('SELECT notifications_seen_at FROM admins WHERE id = ?', [req.admin.adminId]),
            // Support + call-backs waiting for someone to pick them up.
            req.admin.permissions.includes('manage_callbacks') ? settle(supportPlus.pendingForBell()) : [],
            // KYC documents waiting to be checked.
            req.admin.permissions.includes('manage_users')
                ? settle(q(`SELECT id, name, email, kyc_submitted_at AS at FROM users
                            WHERE kyc_status = 'pending' ORDER BY kyc_submitted_at DESC LIMIT 20`))
                : [],
        ]);

        const items = [
            ...signups.map((u) => ({ kind: 'signup', title: `New ${u.account_type || 'personal'} sign-up`, body: `${u.name} · ${u.email}`, userId: u.id, at: u.at })),
            ...kycWaiting.map((u) => ({ kind: 'kyc', title: 'KYC documents to check', body: `${u.name} · ${u.email}`, userId: u.id, at: u.at })),
            ...callbacks.map((c) => ({ kind: 'callback', title: 'Support + call-back requested', body: `${c.account_name || 'Customer'} · ${c.phone}`, section: 'support-plus', at: c.at })),
            ...failedTopups.map((t) => ({ kind: 'payment_failed', title: 'Account balance top-up failed', body: `${t.name || 'Customer'} · ₹${(Number(t.amount) / 100).toFixed(2)}`, userId: t.user_id, at: t.at })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);

        const seenAt = me?.notifications_seen_at ? new Date(me.notifications_seen_at) : null;
        const unread = items.filter((i) => !seenAt || new Date(i.at) > seenAt).length;
        res.json({ items, unread, seenAt });
    }),

    markNotificationsSeen: handle(async (req, res) => {
        await q('UPDATE admins SET notifications_seen_at = NOW() WHERE id = ?', [req.admin.adminId]);
        res.json({ message: 'ok' });
    }),

    // ── Virtual Machine stock ──────────────────────────────────────────────
    /**
     * Stock per plan per Walras location, how many servers of each are on
     * it, and which locations some active SolusVM account serves (stock in
     * a location no account serves can't be sold yet).
     */
    getComputeStock: handle(async (req, res) => {
        const [all, accounts, stockMap, running, plans] = await Promise.all([
            serverLocations.getLocations({ all: true }),
            solusAccounts.listAccounts(),
            computeStock.getStock(),
            q(`SELECT plan_name, location_id, COUNT(*) AS n FROM servers
               WHERE solus_server_id IS NOT NULL GROUP BY plan_name, location_id`),
            computeStock.getPlans({ all: true }),
        ]);
        const served = new Set();
        const planLinked = {};
        for (const a of accounts) {
            if (a.status !== 'active') continue;
            Object.keys(a.locations).forEach((id) => served.add(Number(id)));
            Object.keys(a.plans).forEach((name) => { planLinked[name] = true; });
        }
        const inUse = {};
        for (const r of running) (inUse[r.plan_name] ||= {})[r.location_id] = Number(r.n);
        res.json({
            accounts: accounts.length,
            locations: all.map((l) => ({ id: l.id, name: l.active ? l.name : `${l.name} (hidden)`, served: served.has(l.id) })),
            plans: plans.map((p) => ({
                ...p,
                linked: Boolean(planLinked[p.name]),
                stock: stockMap[p.name],
                inUse: inUse[p.name] || {},
            })),
        });
    }),

    // PUT { plans: [{ name, stock: { [locationId]: quantity } }] }
    updateComputeStock: handle(async (req, res) => {
        const list = Array.isArray(req.body.plans) ? req.body.plans : [];
        const before = await computeStock.getStock();
        const known = new Set((await computeStock.getPlans({ all: true })).map((p) => p.name));
        const locations = new Set((await serverLocations.getLocations({ all: true })).map((l) => l.id));
        const entries = [];
        for (const p of list) {
            if (!known.has(p?.name)) continue;
            for (const [loc, qty] of Object.entries(p.stock || {})) {
                const locationId = Number(loc);
                const quantity = Number(qty);
                if (!locations.has(locationId)) continue;
                if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
                    throw new HttpError(400, `Stock for ${p.name} must be a whole number from 0 to 100000.`);
                }
                entries.push({ plan: p.name, locationId, quantity });
            }
        }
        await computeStock.setStock(entries);
        audit(req, 'compute.stock', 'settings', 'compute', { before, after: await computeStock.getStock() });
        res.json({ message: 'Virtual Machine stock saved' });
    }),

    // ── Support departments (Zendesk groups customers can choose) ────────
    getSupportDepartments: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) return res.json({ configured: false, groups: [], choice: null });
        try {
            const { groups, choice, defaultIds } = await supportDepartments.getAdminView();
            res.json({ configured: true, groups, choice, defaultIds });
        } catch (err) {
            res.json({ configured: true, error: `Couldn't load groups from Zendesk: ${err.message}`, groups: [], choice: null });
        }
    }),

    // PUT { departments: [{ groupId, label }] } or { departments: null } for "all groups".
    updateSupportDepartments: handle(async (req, res) => {
        const list = req.body.departments;
        if (list !== null && (!Array.isArray(list) || list.length === 0)) {
            throw new HttpError(400, 'Choose at least one department, or go back to the default.');
        }
        await supportDepartments.setChoice(list);
        audit(req, 'settings.support_departments', 'settings', 'support', { departments: list });
        res.json({ message: list === null ? 'Back to the default departments.' : 'Support departments saved.' });
    }),

    // ── Support (Zendesk) ────────────────────────────────────────────────
    // Unsolved ticket count for the dashboard; null when Zendesk isn't set up
    // or doesn't answer quickly, so the dashboard never waits on it.
    supportSummary: handle(async (req, res) => {
        const openTickets = await zendesk.countOpenZendeskTickets().catch((err) => {
            console.warn('Zendesk ticket count failed:', err.message);
            return null;
        });
        res.json({ configured: zendesk.zendeskConfigured(), openTickets, agentUrl: zendesk.zendeskAgentUrl() });
    }),
};

module.exports = PlatformController;
