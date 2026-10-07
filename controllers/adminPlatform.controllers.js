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
const solusvm = require('../services/solusvm');
const computeStock = require('../utils/computeStock');

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
        };
        await platform.setPlatform(next);
        audit(req, 'settings.platform', 'settings', 'platform', { before: { maintenanceMode: before.maintenanceMode, paymentsPaused: before.paymentsPaused, topUpsPaused: before.topUpsPaused }, after: next });
        res.json({ message: 'Platform settings saved', ...(await platform.getPlatform()) });
    }),

    updatePlanAvailability: handle(async (req, res) => {
        await platform.setPlanAvailability(req.body.planAvailability);
        const after = await platform.getPlatform();
        audit(req, 'settings.plans', 'settings', 'plans', { planAvailability: after.planAvailability });
        res.json({ message: 'Plan availability saved', ...after });
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
                    lastloginat, lastloginip, createdat
             FROM users WHERE id = ?`,
            [id]
        );
        if (!user) throw new HttpError(404, 'Customer not found');

        const settle = (p) => p.catch((e) => { console.error('User overview part failed:', e.message); return []; });
        const [wallet, hosting, servers, domains, orders, transactions, invoices, sessions] = await Promise.all([
            settle(q('SELECT id, balance, currency, updated_at FROM wallets WHERE user_id = ?', [id])),
            settle(q('SELECT id, domain, plan_name, billing_cycle, cpanel_username, status, expires_at, suspension_reason, created_at FROM hosting_accounts WHERE user_id = ? ORDER BY created_at DESC', [id])),
            settle(q('SELECT id, name, ip_address, plan_name, location, status, hourly_cost, created_at FROM servers WHERE user_id = ? ORDER BY created_at DESC', [id])),
            settle(q('SELECT id, full_domain, status, amount, currency, registration_date, expiration_date, created_at FROM domain_transactions WHERE user_id = ? ORDER BY created_at DESC', [id])),
            settle(q('SELECT id, order_id, plan_name, domain, billing_cycle, total_amount, status, failure_message, created_at FROM hosting_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [id])),
            settle(q(`SELECT wt.id, wt.type, wt.amount, wt.description, wt.status, wt.reference_id, wt.created_at
                      FROM wallet_transactions wt JOIN wallets w ON wt.wallet_id = w.id
                      WHERE w.user_id = ? ORDER BY wt.created_at DESC LIMIT 50`, [id])),
            settle(q('SELECT id, invoice_number, billing_month, total_amount, status, generated_at, due_date FROM monthly_invoices WHERE user_id = ? ORDER BY generated_at DESC LIMIT 24', [id])),
            settle(q('SELECT ip_address, user_agent, login_time FROM user_sessions WHERE user_id = ? ORDER BY login_time DESC LIMIT 10', [id])),
        ]);

        res.json({
            user,
            wallet: wallet[0] || null,
            hosting, servers, domains, orders, transactions, invoices, sessions,
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

        let [wallet] = await q('SELECT id FROM wallets WHERE user_id = ?', [id]);
        if (!wallet) {
            const created = await q('INSERT INTO wallets (user_id, balance) VALUES (?, 0)', [id]);
            wallet = { id: created.insertId };
        }

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
        const type = ['hosting', 'wallet'].includes(req.query.type) ? req.query.type : null;
        const limit = Math.min(500, Math.max(10, Number.parseInt(req.query.limit, 10) || 200));

        const parts = [];
        const params = [];
        if (type !== 'wallet') {
            parts.push(`SELECT 'hosting' AS type, ho.order_id, ho.user_id, u.name AS user_name, u.email,
                               CONCAT(ho.plan_name, ' · ', ho.domain) AS item, ho.total_amount AS amount,
                               ho.status, ho.tracking_id, ho.failure_message, ho.created_at
                        FROM hosting_orders ho LEFT JOIN users u ON u.id = ho.user_id
                        ${status ? 'WHERE ho.status = ?' : ''}`);
            if (status) params.push(status);
        }
        if (type !== 'hosting') {
            parts.push(`SELECT 'wallet' AS type, wt.reference_id AS order_id, w.user_id, u.name AS user_name, u.email,
                               'Account balance top-up' AS item, wt.amount, wt.status, wt.razorpay_payment_id AS tracking_id,
                               NULL AS failure_message, wt.created_at
                        FROM wallet_transactions wt
                        JOIN wallets w ON w.id = wt.wallet_id LEFT JOIN users u ON u.id = w.user_id
                        WHERE wt.type = 'credit' AND (wt.reference_id LIKE 'CCAW%' OR wt.razorpay_order_id IS NOT NULL)
                        ${status ? 'AND wt.status = ?' : ''}`);
            if (status) params.push(status);
        }
        const orders = await q(`${parts.join(' UNION ALL ')} ORDER BY created_at DESC LIMIT ?`, [...params, limit]);
        res.json({ orders });
    }),

    // ── Notifications ────────────────────────────────────────────────────
    /**
     * Derived from the data itself rather than a separate event table: recent
     * sign-ups, hosting orders and failed payments. "Unread" is anything newer
     * than when this admin last opened the bell.
     */
    listNotifications: handle(async (req, res) => {
        const settle = (p) => p.catch(() => []);
        const [signups, orders, failedTopups, [me]] = await Promise.all([
            settle(q(`SELECT id, name, email, account_type, createdat AS at FROM users
                      WHERE createdat > NOW() - INTERVAL '14 days' ORDER BY createdat DESC LIMIT 20`)),
            settle(q(`SELECT ho.order_id, ho.status, ho.total_amount, ho.domain, ho.plan_name, ho.user_id, u.name, ho.created_at AS at
                      FROM hosting_orders ho LEFT JOIN users u ON u.id = ho.user_id
                      WHERE ho.created_at > NOW() - INTERVAL '14 days' AND ho.status IN ('completed', 'failed')
                      ORDER BY ho.created_at DESC LIMIT 20`)),
            settle(q(`SELECT wt.reference_id, wt.amount, w.user_id, u.name, wt.created_at AS at
                      FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id LEFT JOIN users u ON u.id = w.user_id
                      WHERE wt.status = 'failed' AND wt.created_at > NOW() - INTERVAL '14 days'
                      ORDER BY wt.created_at DESC LIMIT 20`)),
            q('SELECT notifications_seen_at FROM admins WHERE id = ?', [req.admin.adminId]),
        ]);

        const items = [
            ...signups.map((u) => ({ kind: 'signup', title: `New ${u.account_type || 'personal'} sign-up`, body: `${u.name} · ${u.email}`, userId: u.id, at: u.at })),
            ...orders.map((o) => ({
                kind: o.status === 'completed' ? 'order' : 'payment_failed',
                title: o.status === 'completed' ? 'Hosting order paid' : 'Hosting payment failed',
                body: `${o.name || 'Customer'} · ${o.plan_name} · ${o.domain} · ₹${(Number(o.total_amount) / 100).toFixed(2)}`,
                userId: o.user_id,
                at: o.at,
            })),
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
     * Stock per plan per SolusVM location, each plan's linked SolusVM plan,
     * and how many servers of each are running now. Lists from SolusVM are
     * fetched fresh so new plans and locations show up straight away.
     */
    getComputeStock: handle(async (req, res) => {
        const configured = solusvm.solusConfigured();
        let locations = [];
        let solusPlans = [];
        let solusError = null;
        if (configured) {
            solusvm.forgetCatalog();
            try {
                [locations, solusPlans] = await Promise.all([solusvm.listLocations(), solusvm.listPlans()]);
            } catch (err) {
                solusError = err.message;
            }
        }
        const [stockMap, planMap, running] = await Promise.all([
            computeStock.getStock(),
            computeStock.getPlanMap(),
            q(`SELECT plan_name, location_id, COUNT(*) AS n FROM servers
               WHERE solus_server_id IS NOT NULL GROUP BY plan_name, location_id`),
        ]);
        const inUse = {};
        for (const r of running) (inUse[r.plan_name] ||= {})[r.location_id] = Number(r.n);
        res.json({
            configured,
            solusError,
            locations,
            solusPlans,
            plans: computeStock.COMPUTE_PLANS.map((p) => ({
                ...p,
                solusPlanId: planMap[p.name] || null,
                stock: stockMap[p.name],
                inUse: inUse[p.name] || {},
            })),
        });
    }),

    // PUT { plans: [{ name, solusPlanId, stock: { [locationId]: quantity } }] }
    updateComputeStock: handle(async (req, res) => {
        const list = Array.isArray(req.body.plans) ? req.body.plans : [];
        const before = { stock: await computeStock.getStock(), planMap: await computeStock.getPlanMap() };
        const entries = [];
        const map = {};
        for (const p of list) {
            if (!computeStock.findPlan(p?.name)) continue;
            if (p.solusPlanId !== undefined) map[p.name] = p.solusPlanId;
            for (const [loc, qty] of Object.entries(p.stock || {})) {
                const locationId = Number(loc);
                const quantity = Number(qty);
                if (!Number.isInteger(locationId) || !Number.isInteger(quantity) || quantity < 0 || quantity > 100000) {
                    throw new HttpError(400, `Stock for ${p.name} must be a whole number from 0 to 100000.`);
                }
                entries.push({ plan: p.name, locationId, quantity });
            }
        }
        await computeStock.setStock(entries);
        await computeStock.setPlanMap({ ...before.planMap, ...map });
        const after = { stock: await computeStock.getStock(), planMap: await computeStock.getPlanMap() };
        audit(req, 'compute.stock', 'settings', 'compute', { before, after });
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
