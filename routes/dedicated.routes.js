const express = require('express');
const router = express.Router();
const authenticateToken = require('../utils/auth.middleware');
const { requireSalesOpen } = require('../utils/platformSettings');
const { requireKyc } = require('../utils/kyc');
const rateLimit = require('../utils/rateLimit');
const Dedicated = require('../controllers/dedicated.controllers');

// Dedicated (controllers/dedicated.controllers.js). The catalog is
// public (metal.walras.net); orders need a session. Team members need
// Servers access (utils/team.js).
router.get('/catalog', Dedicated.catalog);

router.use(authenticateToken);
const orderLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyFn: (req) => `dedicated-order:${req.user?.userId}`, message: 'Too many orders. Please wait a while, or contact support.' });
router.get('/orders', Dedicated.orders);
router.post('/orders', orderLimit, requireSalesOpen, requireKyc('dedicated'), Dedicated.order);

module.exports = router;
