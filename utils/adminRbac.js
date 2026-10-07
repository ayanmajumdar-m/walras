const connection = require('../config/db');

/**
 * Admin roles and permissions.
 *
 * super_admin always has every permission, whatever admin_role_permissions
 * says, so the panel can never be locked out of its own governance. Every
 * other role's permissions live in that table and can be edited from the
 * Administrators page; the defaults below are written the first time only.
 */

const ROLES = [
    { id: 'super_admin', label: 'Super admin', description: 'Everything, including administrators and settings.' },
    { id: 'admin', label: 'Admin', description: 'Day-to-day operations across customers and services.' },
    { id: 'support', label: 'Support', description: 'Help customers: view accounts and services.' },
    { id: 'finance', label: 'Finance', description: 'Orders, transactions, invoices and wallets.' },
    { id: 'readonly', label: 'Read only', description: 'Can look, cannot change anything.' },
];

const PERMISSIONS = [
    { id: 'view_dashboard', label: 'View dashboard', group: 'Operations' },
    { id: 'view_users', label: 'View customers', group: 'Customers' },
    { id: 'manage_users', label: 'Verify, suspend and delete customers', group: 'Customers' },
    { id: 'manage_wallets', label: 'Credit or debit wallets', group: 'Billing' },
    { id: 'view_billing', label: 'View orders, transactions and invoices', group: 'Billing' },
    { id: 'manage_billing', label: 'Change invoices and generate billing', group: 'Billing' },
    { id: 'manage_coupons', label: 'Manage promo codes', group: 'Billing' },
    { id: 'view_services', label: 'View servers, hosting and domains', group: 'Services' },
    { id: 'manage_services', label: 'Suspend, delete and log in to services', group: 'Services' },
    { id: 'manage_plans', label: 'Change plans and prices', group: 'Services' },
    { id: 'send_bulk_email', label: 'Email all customers', group: 'Customers' },
    { id: 'view_audit_logs', label: 'View audit logs', group: 'Governance' },
    { id: 'manage_settings', label: 'Change platform settings', group: 'Governance' },
    { id: 'manage_admins', label: 'Manage administrators and roles', group: 'Governance' },
];

const ALL = PERMISSIONS.map((p) => p.id);

const DEFAULTS = {
    admin: ALL.filter((p) => !['manage_admins', 'manage_settings', 'send_bulk_email', 'manage_plans'].includes(p)),
    support: ['view_dashboard', 'view_users', 'view_billing', 'view_services'],
    finance: ['view_dashboard', 'view_users', 'manage_wallets', 'view_billing', 'manage_billing', 'manage_coupons'],
    readonly: ['view_dashboard', 'view_users', 'view_billing', 'view_services', 'view_audit_logs'],
};

const query = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

let cache = null;
let cachedAt = 0;
const CACHE_MS = 30 * 1000;

const loadMatrix = async () => {
    if (cache && Date.now() - cachedAt < CACHE_MS) return cache;
    let rows = await query('SELECT role, permission FROM admin_role_permissions');
    if (rows.length === 0) {
        // First run: write the defaults once. After this the table is the truth,
        // so a permission an admin removes stays removed across restarts.
        for (const [role, perms] of Object.entries(DEFAULTS)) {
            for (const permission of perms) {
                await query(
                    'INSERT INTO admin_role_permissions (role, permission) VALUES (?, ?) ON CONFLICT (role, permission) DO NOTHING',
                    [role, permission]
                );
            }
        }
        rows = await query('SELECT role, permission FROM admin_role_permissions');
    }
    const matrix = {};
    for (const r of ROLES) matrix[r.id] = r.id === 'super_admin' ? [...ALL] : [];
    for (const { role, permission } of rows) {
        if (role !== 'super_admin' && matrix[role] && ALL.includes(permission)) matrix[role].push(permission);
    }
    cache = matrix;
    cachedAt = Date.now();
    return matrix;
};

const permissionsFor = async (role) => (await loadMatrix())[role] || [];

const setPermission = async (role, permission, allowed) => {
    if (role === 'super_admin') throw new Error('Super admins always have every permission');
    if (!ROLES.some((r) => r.id === role)) throw new Error('Unknown role');
    if (!ALL.includes(permission)) throw new Error('Unknown permission');
    await loadMatrix(); // make sure defaults exist before the first edit
    if (allowed) {
        await query(
            'INSERT INTO admin_role_permissions (role, permission) VALUES (?, ?) ON CONFLICT (role, permission) DO NOTHING',
            [role, permission]
        );
    } else {
        await query('DELETE FROM admin_role_permissions WHERE role = ? AND permission = ?', [role, permission]);
    }
    cache = null;
};

const isRole = (role) => ROLES.some((r) => r.id === role);

module.exports = { ROLES, PERMISSIONS, permissionsFor, loadMatrix, setPermission, isRole };
