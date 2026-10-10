const express = require('express');
const supportRouter = express.Router();
const SupportController = require('../controllers/support.controllers');
const authenticateToken = require('../utils/auth.middleware');
const rateLimit = require('../utils/rateLimit');

const MINUTE = 60 * 1000;
const userKey = (prefix) => (req) => `${prefix}:${req.user?.userId}`;

// Attachments travel as base64 in JSON: 5 files × 10 MB, plus ~35% encoding.
supportRouter.use(express.json({ limit: '70mb' }));
supportRouter.use(authenticateToken);

const readLimit = rateLimit({ windowMs: MINUTE, max: 60, keyFn: userKey('support-read') });
const createLimit = rateLimit({ windowMs: 60 * MINUTE, max: 10, keyFn: userKey('support-create'), message: 'Too many tickets opened. Please wait a while, or reply on an existing ticket.' });
const replyLimit = rateLimit({ windowMs: 15 * MINUTE, max: 30, keyFn: userKey('support-reply') });

supportRouter.get('/status', SupportController.status);
supportRouter.get('/departments', readLimit, SupportController.departments);
supportRouter.get('/tickets', readLimit, SupportController.list);
supportRouter.post('/tickets', createLimit, SupportController.create);
supportRouter.get('/tickets/:id', readLimit, SupportController.get);
supportRouter.post('/tickets/:id/reply', replyLimit, SupportController.reply);
supportRouter.get('/tickets/:id/attachments/:attachmentId', readLimit, SupportController.attachment);

// Support + (priority phone support) and its call-back requests.
const SupportPlus = require('../controllers/supportPlus.controllers');
const planLimit = rateLimit({ windowMs: 15 * MINUTE, max: 10, keyFn: userKey('support-plus') });
const callbackLimit = rateLimit({ windowMs: 60 * MINUTE, max: 10, keyFn: userKey('support-callback'), message: 'Too many call-back requests. Please wait a while.' });
supportRouter.get('/plus', readLimit, SupportPlus.overview);
supportRouter.post('/plus', planLimit, SupportPlus.enable);
supportRouter.delete('/plus', planLimit, SupportPlus.cancel);
supportRouter.post('/plus/keep', planLimit, SupportPlus.keep);
supportRouter.get('/callbacks', readLimit, SupportPlus.callbacks);
supportRouter.post('/callbacks', callbackLimit, SupportPlus.requestCallback);
supportRouter.post('/callbacks/:id/cancel', planLimit, SupportPlus.cancelCallback);

module.exports = supportRouter;
