const AdminController = require('../controllers/admin.controllers');
const { authenticateAdminToken, requireOwnerAccess, requireBillingAccess } = require('../utils/admin.middleware');
const router = require('express').Router();

// Admin authentication (no middleware needed)
router.post('/create', AdminController.register);
router.post('/login', AdminController.login);

// All admin routes below require authentication
router.use(authenticateAdminToken);

// Owner-only routes
router.get('/viewAllUsers', requireOwnerAccess, AdminController.viewUsers);
router.get('/getAllUsersWithDetails', requireOwnerAccess, AdminController.getAllUsersWithDetails);
router.get('/getUser/:id', requireOwnerAccess, AdminController.getUser);
router.delete('/deleteUser/:id', requireOwnerAccess, AdminController.deleteUser);
router.post('/updateUserStatus', requireOwnerAccess, AdminController.updateUserStatus);

// Dashboard statistics (owner only)
router.get('/dashboardStats', requireOwnerAccess, AdminController.getDashboardStats);
router.get('/getTotalUsers', requireOwnerAccess, AdminController.getTotalUsers);
router.get('/getTotalServers', requireOwnerAccess, AdminController.getTotalServers);
router.get('/getTotalBillingLogs', requireBillingAccess, AdminController.getTotalBillingLogs);
router.get('/getTotalInvoices', requireBillingAccess, AdminController.getTotalInvoices);
router.get('/getTotalRevenue', requireOwnerAccess, AdminController.getTotalRevenue);

// Transaction management (billing access allowed)
router.get('/getAllTransactions', requireBillingAccess, AdminController.getAllTransactions);
router.get('/getUserTransactions/:id', requireBillingAccess, AdminController.getUserTransactions);
router.get('/getBillingLogs', requireBillingAccess, AdminController.getBillingLogs);
router.get('/getUserBillingLogs/:id', requireBillingAccess, AdminController.getUserBillingLogs);

// Server management (owner only)
router.get('/getAllServers', requireOwnerAccess, AdminController.getAllServers);
router.get('/getUserServers/:id', requireOwnerAccess, AdminController.getUserServers);

// Hosting management (cPanel) (owner only)
router.get('/getAllHosting', requireOwnerAccess, AdminController.getAllHosting);
router.post('/hosting/:id/suspend', requireOwnerAccess, AdminController.suspendHosting);
router.post('/hosting/:id/unsuspend', requireOwnerAccess, AdminController.unsuspendHosting);
router.delete('/hosting/:id', requireOwnerAccess, AdminController.deleteHosting);
router.get('/hosting/:id/login', requireOwnerAccess, AdminController.getHostingLogin);

//Get all domains bought
router.get('/getAllDomains', requireOwnerAccess, AdminController.getAllDomains);

// Session and IP management (owner only)
router.get('/getActiveSessions', requireOwnerAccess, AdminController.getActiveSessions);
router.get('/getUniqueIPs', requireOwnerAccess, AdminController.getUniqueIPs);
router.get('/getUserSessions/:id', requireOwnerAccess, AdminController.getUserSessions);
router.get('/getUserIPs/:id', requireOwnerAccess, AdminController.getUserIPs);
router.post('/forceLogout', requireOwnerAccess, AdminController.forceLogout);

// Activity monitoring (owner only)
router.get('/getRecentActivity', requireOwnerAccess, AdminController.getRecentActivity);
router.put('/verifyUser', requireOwnerAccess, AdminController.verifyUser);
router.delete('/deleteUser/:id', requireOwnerAccess, AdminController.deleteUser);


// Promo code management (owner only)
router.get('/promo-codes', requireOwnerAccess, AdminController.getAllPromoCodes);
router.post('/promo-codes', requireOwnerAccess, AdminController.createPromoCode);
router.put('/promo-codes/:id', requireOwnerAccess, AdminController.updatePromoCode);
router.delete('/promo-codes/:id', requireOwnerAccess, AdminController.deletePromoCode);
router.get('/promo-codes/stats', requireOwnerAccess, AdminController.getPromoCodeStats);

// Monthly invoices (billing access allowed)
router.get('/monthly-invoices', requireBillingAccess, AdminController.getAllMonthlyInvoices);
router.get('/monthly-invoices/:userId', requireBillingAccess, AdminController.getUserMonthlyInvoices);
router.post('/generate-monthly-invoices', requireOwnerAccess, AdminController.generateMonthlyInvoices);
router.post('/create-sample-invoice', requireOwnerAccess, AdminController.createSampleInvoice);
router.put('/monthly-invoices/:id/status', requireBillingAccess, AdminController.updateInvoiceStatus);
router.get('/monthly-invoices/:id/download', requireBillingAccess, AdminController.downloadMonthlyInvoice);
router.get('/sample-invoice', requireBillingAccess, AdminController.generateSampleInvoice);

module.exports = router;