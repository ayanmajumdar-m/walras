const express = require('express');
const authenticateToken = require('../utils/auth.middleware');
const Invoices = require('../controllers/invoices.controllers');

const router = express.Router();
router.use(express.json());
router.use(authenticateToken);

// :id is checked to be numeric in the controller (Express 5 has no regex params).
router.get('/', Invoices.list);
router.get('/:id', Invoices.get);
router.get('/:id/pdf', Invoices.pdf);
router.post('/:id/pay', Invoices.pay);

module.exports = router;
