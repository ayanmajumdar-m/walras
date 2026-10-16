const express = require('express');
const router = express.Router();
const Kyc = require('../controllers/kyc.controllers');
const authenticateToken = require('../utils/auth.middleware');
const rateLimit = require('../utils/rateLimit');

const MINUTE = 60 * 1000;
const userKey = (prefix) => (req) => `${prefix}:${req.user?.userId}`;

// Up to six documents of 5 MB as base64 in JSON (~35% encoding).
router.use(express.json({ limit: '45mb' }));
router.use(authenticateToken);

router.get('/status', rateLimit({ windowMs: MINUTE, max: 60, keyFn: userKey('kyc-read') }), Kyc.status);
router.post('/', rateLimit({ windowMs: 60 * MINUTE, max: 5, keyFn: userKey('kyc-submit'), message: 'Too many attempts. Please wait a while, or email support@walras.net.' }), Kyc.submit);

module.exports = router;
