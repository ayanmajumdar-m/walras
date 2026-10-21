const AdminController = require('../controllers/admin.controllers');
const SettingsController = require('../controllers/settings.controllers');
const Platform = require('../controllers/adminPlatform.controllers');
const { authenticateAdminToken, requirePermission: can } = require('../utils/admin.middleware');
const audit = require('../utils/audit');
const rateLimit = require('../utils/rateLimit');
const router = require('express').Router();

const logged = audit.route;
const byParam = (name) => (req) => req.params[name];
const byBody = (name) => (req) => req.body?.[name];

// ── Public: admin sign-in only ─────────────────────────────────────────────
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many sign-in attempts. Try again in 15 minutes.' });
router.post('/login', loginLimit, AdminController.login);

// Everything below needs a valid admin session.
router.use(authenticateAdminToken);

router.get('/me', Platform.me);

// ── Administrators & roles ─────────────────────────────────────────────────
router.get('/admins', can('manage_admins'), Platform.listAdmins);
router.post('/admins', can('manage_admins'), Platform.createAdmin);
router.patch('/admins/:id', can('manage_admins'), Platform.updateAdmin);
router.post('/admins/:id/reset-password', can('manage_admins'), Platform.resetAdminPassword);
router.delete('/admins/:id', can('manage_admins'), Platform.deleteAdmin);
router.get('/roles', can('manage_admins'), Platform.getRoles);
router.put('/roles/:role/permissions', can('manage_admins'), Platform.setRolePermission);

// ── Audit logs ─────────────────────────────────────────────────────────────
router.get('/audit-logs', can('view_audit_logs'), Platform.listAuditLogs);

// ── Settings ───────────────────────────────────────────────────────────────
router.get('/settings/platform', can('manage_settings'), Platform.getPlatformSettings);
router.put('/settings/platform', can('manage_settings'), Platform.updatePlatformSettings);
router.put('/settings/invoice', can('manage_settings'), Platform.updateInvoiceDetails);
router.get('/settings/kyc', can('manage_settings'), Platform.getKycSettings);
router.put('/settings/kyc', can('manage_settings'), Platform.updateKycSettings);
router.get('/settings/mail', can('manage_settings'), SettingsController.getMail);
router.put('/settings/mail', can('manage_settings'), logged('settings.mail', 'settings', () => 'mail', (req) => ({ fromAddress: req.body.fromAddress, fromName: req.body.fromName })), SettingsController.updateMail);
router.post('/settings/mail/test', can('manage_settings'), logged('settings.mail_test', 'settings', () => 'mail', (req) => ({ to: req.body.to })), SettingsController.testMail);

// ── Notifications ──────────────────────────────────────────────────────────
router.get('/notifications', Platform.listNotifications);
router.post('/notifications/seen', Platform.markNotificationsSeen);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboardStats', can('view_dashboard'), AdminController.getDashboardStats);
router.get('/support/summary', can('view_dashboard'), Platform.supportSummary);
router.get('/settings/support-departments', can('manage_settings'), Platform.getSupportDepartments);
router.put('/settings/support-departments', can('manage_settings'), Platform.updateSupportDepartments);

// Email customers (bulk)
const BulkEmail = require('../controllers/bulkEmail.controllers');
router.get('/bulk-email', can('send_bulk_email'), BulkEmail.overview);
router.get('/bulk-email/customers', can('send_bulk_email'), BulkEmail.customers);
router.post('/bulk-email/test', can('send_bulk_email'), BulkEmail.test);
router.post('/bulk-email', can('send_bulk_email'), BulkEmail.send);
router.post('/bulk-email/:id/cancel', can('send_bulk_email'), BulkEmail.cancel);
router.post('/bulk-email/:id/resume', can('send_bulk_email'), BulkEmail.resume);

// Virtual Machine plans and prices
const VmPlans = require('../controllers/vmPlans.controllers');
router.get('/vm-plans', can('view_services'), VmPlans.list);
router.post('/vm-plans', can('manage_plans'), VmPlans.create);
router.put('/vm-plans/:id', can('manage_plans'), VmPlans.update);
router.delete('/vm-plans/:id', can('manage_plans'), VmPlans.remove);

// SolusVM accounts (several panels, each with a server limit).
const SolusAccounts = require('../controllers/solusAccounts.controllers');
router.get('/solus-accounts', can('view_services'), SolusAccounts.list);
router.get('/solus-accounts/:id/catalog', can('manage_integrations'), SolusAccounts.catalog);
router.post('/solus-accounts', can('manage_integrations'), SolusAccounts.create);
router.put('/solus-accounts/:id', can('manage_integrations'), SolusAccounts.update);
router.post('/solus-accounts/:id/test', can('manage_integrations'), SolusAccounts.test);
router.delete('/solus-accounts/:id', can('manage_integrations'), SolusAccounts.remove);

// Managed Database: plans, stock and customers' databases (set up by admins for now)
const Databases = require('../controllers/adminDatabases.controllers');
router.get('/db/plans', can('view_services'), Databases.listPlans);
router.post('/db/plans', can('manage_plans'), Databases.createPlan);
router.put('/db/plans/:id', can('manage_plans'), Databases.updatePlan);
router.delete('/db/plans/:id', can('manage_plans'), Databases.removePlan);
router.get('/db/stock', can('view_services'), Databases.getStock);
router.put('/db/stock', can('manage_services'), Databases.updateStock);
router.get('/db/databases', can('view_services'), Databases.listDatabases);
router.put('/db/databases/:id/ready', can('manage_services'), Databases.markReady);
router.post('/db/databases/:id/refund', can('manage_services'), Databases.refund);

// App Platform: plans and customers' apps
const Apps = require('../controllers/adminApps.controllers');
router.get('/apps', can('view_services'), Apps.listApps);
router.get('/apps/plans', can('view_services'), Apps.listPlans);
router.get('/apps/stock', can('view_services'), Apps.getStock);
router.put('/apps/stock', can('manage_services'), Apps.updateStock);
router.post('/apps/plans', can('manage_plans'), Apps.createPlan);
router.put('/apps/plans/:id', can('manage_plans'), Apps.updatePlan);
router.delete('/apps/plans/:id', can('manage_plans'), Apps.removePlan);
// Where Managed Database and App Platform are offered (Mumbai to start)
router.get('/product-locations/:product', can('view_services'), Apps.getProductLocations);
router.put('/product-locations/:product', can('manage_plans'), Apps.setProductLocations);

// Dedicated Servers: listings and orders (no payment or provisioning yet)
const Dedicated = require('../controllers/adminDedicated.controllers');
router.get('/dedicated/servers', can('view_services'), Dedicated.listServers);
router.post('/dedicated/servers', can('manage_plans'), Dedicated.createServer);
router.put('/dedicated/servers/:id', can('manage_plans'), Dedicated.updateServer);
router.delete('/dedicated/servers/:id', can('manage_plans'), Dedicated.removeServer);
router.get('/dedicated/orders', can('view_services'), Dedicated.listOrders);
router.put('/dedicated/orders/:id', can('manage_services'), Dedicated.setOrderStatus);

// Server locations
const Locations = require('../controllers/serverLocations.controllers');
router.get('/locations', can('view_services'), Locations.list);
router.post('/locations', can('manage_plans'), Locations.create);
router.put('/locations/:id', can('manage_plans'), Locations.update);
router.delete('/locations/:id', can('manage_plans'), Locations.remove);

// Virtual Machine stock (per plan per SolusVM location)
router.get('/compute/stock', can('view_services'), Platform.getComputeStock);
router.put('/compute/stock', can('manage_services'), Platform.updateComputeStock);
router.get('/getTotalUsers', can('view_dashboard'), AdminController.getTotalUsers);
router.get('/getTotalServers', can('view_dashboard'), AdminController.getTotalServers);
router.get('/getTotalRevenue', can('view_dashboard'), AdminController.getTotalRevenue);
router.get('/getRecentActivity', can('view_dashboard'), AdminController.getRecentActivity);
router.get('/getTotalBillingLogs', can('view_billing'), AdminController.getTotalBillingLogs);
router.get('/getTotalInvoices', can('view_billing'), AdminController.getTotalInvoices);

// ── Customers ──────────────────────────────────────────────────────────────
router.get('/viewAllUsers', can('view_users'), AdminController.viewUsers);
router.get('/getAllUsersWithDetails', can('view_users'), AdminController.getAllUsersWithDetails);
router.get('/getUser/:id', can('view_users'), AdminController.getUser);
router.get('/users/:id/overview', can('view_users'), Platform.getUserOverview);
router.post('/users/:id/suspend', can('manage_users'), Platform.suspendUser);
router.post('/users/:id/unsuspend', can('manage_users'), Platform.unsuspendUser);
router.put('/users/:id/kyc', can('manage_users'), Platform.setKyc);
router.post('/users/:id/wallet-adjust', can('manage_wallets'), Platform.adjustWallet);
router.delete('/deleteUser/:id', can('manage_users'), logged('user.delete', 'user', byParam('id')), AdminController.deleteUser);
router.post('/updateUserStatus', can('manage_users'), logged('user.status', 'user', byBody('userId'), (req) => ({ status: req.body.status })), AdminController.updateUserStatus);
router.put('/verifyUser', can('manage_users'), logged('user.verify', 'user', byBody('userId')), AdminController.verifyUser);
router.get('/getActiveSessions', can('view_users'), AdminController.getActiveSessions);
router.get('/getUniqueIPs', can('view_users'), AdminController.getUniqueIPs);
router.get('/getUserSessions/:id', can('view_users'), AdminController.getUserSessions);
router.get('/getUserIPs/:id', can('view_users'), AdminController.getUserIPs);
router.post('/forceLogout', can('manage_users'), logged('user.force_logout', 'session', byBody('sessionId')), AdminController.forceLogout);

// ── Billing ────────────────────────────────────────────────────────────────
router.get('/orders', can('view_billing'), Platform.listOrders);
router.get('/getAllTransactions', can('view_billing'), AdminController.getAllTransactions);
router.get('/getUserTransactions/:id', can('view_billing'), AdminController.getUserTransactions);
router.get('/getBillingLogs', can('view_billing'), AdminController.getBillingLogs);
router.get('/getUserBillingLogs/:id', can('view_billing'), AdminController.getUserBillingLogs);
// Monthly invoices (postpaid billing, utils/monthlyBilling.js)
const Invoices = require('../controllers/adminInvoices.controllers');
router.get('/monthly-invoices', can('view_billing'), Invoices.list);
router.get('/monthly-invoices/:id', can('view_billing'), Invoices.get);
router.get('/monthly-invoices/:id/download', can('view_billing'), Invoices.download);
router.post('/monthly-invoices/:id/waive-fee', can('manage_billing'), Invoices.waiveFee);
router.post('/monthly-invoices/:id/mark-paid', can('manage_billing'), Invoices.markPaid);
router.post('/generate-monthly-invoices', can('manage_billing'), Invoices.generate);

// ── Support tickets (Zendesk, read-only) ───────────────────────────────────
const Tickets = require('../controllers/adminTickets.controllers');
router.get('/support/tickets', can('view_tickets'), Tickets.list);
router.get('/support/tickets/:id', can('view_tickets'), Tickets.get);

// ── Support + (priority phone support) ─────────────────────────────────────
const SupportPlus = require('../controllers/adminSupportPlus.controllers');
router.get('/support-plus/callbacks', can('manage_callbacks'), SupportPlus.list);
router.put('/support-plus/callbacks/:id', can('manage_callbacks'), SupportPlus.setStatus);
router.get('/support-plus/subscribers', can('manage_callbacks'), SupportPlus.subscribers);

// ── Promo codes ────────────────────────────────────────────────────────────
router.get('/promo-codes', can('manage_coupons', 'view_billing'), AdminController.getAllPromoCodes);
router.get('/promo-codes/stats', can('manage_coupons', 'view_billing'), AdminController.getPromoCodeStats);
router.post('/promo-codes', can('manage_coupons'), logged('promo.create', 'promo', () => null, (req) => ({ code: req.body.code })), AdminController.createPromoCode);
router.put('/promo-codes/:id', can('manage_coupons'), logged('promo.update', 'promo', byParam('id')), AdminController.updatePromoCode);
router.delete('/promo-codes/:id', can('manage_coupons'), logged('promo.delete', 'promo', byParam('id')), AdminController.deletePromoCode);

// ── Services ───────────────────────────────────────────────────────────────
router.get('/getAllServers', can('view_services'), AdminController.getAllServers);
router.get('/getUserServers/:id', can('view_services'), AdminController.getUserServers);
router.get('/getAllDomains', can('view_services'), AdminController.getAllDomains);

module.exports = router;
