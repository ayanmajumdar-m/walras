const authRouter = require('express').Router();
const AuthController = require('../controllers/auth.controllers');
const authenticateToken = require('../utils/auth.middleware');
const rateLimit = require('../utils/rateLimit');
const { requireNotMaintenance: open } = require('../utils/platformSettings');

const MINUTE = 60 * 1000;
const emailKey = (prefix) => (req) =>
    `${prefix}:${String(req.body?.email || '').trim().toLowerCase()}`;

// Per IP: stops one machine from creating accounts or spraying logins.
const registerLimit = rateLimit({ windowMs: 60 * MINUTE, max: 10, message: 'Too many sign-ups from this network. Please try again later.' });
const loginIpLimit = rateLimit({ windowMs: 15 * MINUTE, max: 30 });
// Per email: stops many machines from hammering one account or one code.
const loginEmailLimit = rateLimit({ windowMs: 15 * MINUTE, max: 10, keyFn: emailKey('login') });
const codeLimit = rateLimit({ windowMs: 15 * MINUTE, max: 20, keyFn: emailKey('code') });
const sendLimit = rateLimit({ windowMs: 60 * MINUTE, max: 6, keyFn: emailKey('send'), message: 'Too many emails requested. Please try again later.' });

authRouter.post('/register', open, registerLimit, AuthController.register);
authRouter.post('/verify-email', open, codeLimit, AuthController.verifyEmail);
authRouter.post('/resend-code', open, sendLimit, AuthController.resendCode);
authRouter.post('/login', open, loginIpLimit, loginEmailLimit, AuthController.login);
authRouter.post('/forgot-password', open, sendLimit, AuthController.forgotPassword);
authRouter.post('/reset-password', open, codeLimit, AuthController.resetPassword);
authRouter.post('/change-password', authenticateToken, AuthController.changePassword);
authRouter.post('/logout', AuthController.logout);

module.exports = authRouter;
