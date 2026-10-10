const express = require('express');
const router = express.Router();
const authenticateToken = require('../utils/auth.middleware');
const { requireTopUpsOpen } = require('../utils/platformSettings');
const paymentController = require('../controllers/payment.controllers');

// Razorpay signs the exact bytes it sends, so the webhook reads the raw body.
// This router is mounted before the app's JSON body parser (index.js).
router.post('/razorpay/webhook', express.raw({ type: '*/*', limit: '1mb' }), paymentController.webhook);

router.use(express.json());
router.post('/razorpay/topup', authenticateToken, requireTopUpsOpen, paymentController.startTopup);
router.post('/razorpay/verify', authenticateToken, paymentController.verify);

module.exports = router;
