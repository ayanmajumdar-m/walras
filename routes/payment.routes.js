const express = require('express');
const router = express.Router();
const authenticateToken = require('../utils/auth.middleware');
const { requireSalesOpen } = require('../utils/platformSettings');
const paymentController = require('../controllers/payment.controllers');

// Initiates a CCAvenue wallet topup payment session
router.post('/ccavenue/initiate-wallet', authenticateToken, requireSalesOpen, paymentController.initiateWalletTopup);

// Public callback webhook endpoints from CCAvenue
router.post('/ccavenue/response', paymentController.handleCcavenueResponse);
router.post('/ccavenue/cancel', paymentController.handleCcavenueCancel);

module.exports = router;
