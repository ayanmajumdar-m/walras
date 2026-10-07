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
router.put('/settings/plans', can('manage_settings'), Platform.updatePlanAvailability);
router.put('/settings/invoice', can('manage_settings'), Platform.updateInvoiceDetails);
router.get('/settings/mail', can('manage_settings'), SettingsController.getMail);
router.put('/settings/mail', can('manage_settings'), logged('settings.mail', 'settings', () => 'mail', (req) => ({ fromAddress: req.body.fromAddress, fromName: req.body.fromName })), SettingsController.updateMail);
router.post('/settings/mail/test', can('manage_settings'), logged('settings.mail_test', 'settings', () => 'mail', (req) => ({ to: req.body.to })), SettingsController.testMail);

// ── Notifications ──────────────────────────────────────────────────────────
router.get('/notifications', Platform.listNotifications);
router.post('/notifications/seen', Platform.markNotificationsSeen);

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboardStats', can('view_dashboard'), AdminController.getDashboardStats);
router.get('/support/summary', can('view_dashboard'), Platform.supportSummary);

// Email customers (bulk)
const BulkEmail = require('../controllers/bulkEmail.controllers');
router.get('/bulk-email', can('send_bulk_email'), BulkEmail.overview);
router.get('/bulk-email/customers', can('send_bulk_email'), BulkEmail.customers);
router.post('/bulk-email/test', can('send_bulk_email'), BulkEmail.test);
router.post('/bulk-email', can('send_bulk_email'), BulkEmail.send);
router.post('/bulk-email/:id/cancel', can('send_bulk_email'), BulkEmail.cancel);
router.post('/bulk-email/:id/resume', can('send_bulk_email'), BulkEmail.resume);

// Cloud Compute stock (per plan per SolusVM location)
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
router.get('/monthly-invoices', can('view_billing'), AdminController.getAllMonthlyInvoices);
router.get('/monthly-invoices/:userId', can('view_billing'), AdminController.getUserMonthlyInvoices);
router.get('/monthly-invoices/:id/download', can('view_billing'), AdminController.downloadMonthlyInvoice);
router.get('/sample-invoice', can('view_billing'), AdminController.generateSampleInvoice);
router.put('/monthly-invoices/:id/status', can('manage_billing'), logged('invoice.status', 'invoice', byParam('id'), (req) => ({ status: req.body.status })), AdminController.updateInvoiceStatus);
router.post('/generate-monthly-invoices', can('manage_billing'), logged('invoice.generate', 'invoice'), AdminController.generateMonthlyInvoices);
router.post('/create-sample-invoice', can('manage_billing'), logged('invoice.create_sample', 'invoice'), AdminController.createSampleInvoice);

// ── Promo codes ────────────────────────────────────────────────────────────
router.get('/promo-codes', can('manage_coupons', 'view_billing'), AdminController.getAllPromoCodes);
router.get('/promo-codes/stats', can('manage_coupons', 'view_billing'), AdminController.getPromoCodeStats);
router.post('/promo-codes', can('manage_coupons'), logged('promo.create', 'promo', () => null, (req) => ({ code: req.body.code })), AdminController.createPromoCode);
router.put('/promo-codes/:id', can('manage_coupons'), logged('promo.update', 'promo', byParam('id')), AdminController.updatePromoCode);
router.delete('/promo-codes/:id', can('manage_coupons'), logged('promo.delete', 'promo', byParam('id')), AdminController.deletePromoCode);

// ── Services ───────────────────────────────────────────────────────────────
router.get('/getAllServers', can('view_services'), AdminController.getAllServers);
router.get('/getUserServers/:id', can('view_services'), AdminController.getUserServers);
router.get('/getAllHosting', can('view_services'), AdminController.getAllHosting);
router.get('/hostingPackages', can('view_services'), AdminController.getWhmPackages);
router.get('/getAllDomains', can('view_services'), AdminController.getAllDomains);
router.post('/hosting/:id/suspend', can('manage_services'), logged('hosting.suspend', 'hosting', byParam('id')), AdminController.suspendHosting);
router.post('/hosting/:id/unsuspend', can('manage_services'), logged('hosting.unsuspend', 'hosting', byParam('id')), AdminController.unsuspendHosting);
router.delete('/hosting/:id', can('manage_services'), logged('hosting.delete', 'hosting', byParam('id')), AdminController.deleteHosting);
router.get('/hosting/:id/login', can('manage_services'), logged('hosting.cpanel_login', 'hosting', byParam('id')), AdminController.getHostingLogin);

module.exports = router;
