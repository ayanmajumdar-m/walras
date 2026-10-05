/**
 * Walras Cloud sign-up and sign-in.
 *
 * Email + password, with the email address confirmed by a 6-digit code sent
 * through Brevo before the account can sign in. Password reset uses the same
 * kind of code. The session itself is unchanged: a JWT carrying { userId },
 * read by utils/auth.middleware.js on every protected route.
 */

const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requestIp = require('request-ip');
const dotenv = require('dotenv');
const User = require('../model/User.model');
const EmailCode = require('../model/EmailCode.model');
const { sendAuthCodeEmail } = require('../utils/sendEmail');
const { validateEmail, validatePhone } = require('../utils/validation');

dotenv.config();
const { JWT_SECRET } = process.env;

// jsonwebtoken rejects `expiresIn: undefined` outright, so an unset variable
// used to throw on every sign-in rather than falling back to a default.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const CODE_MINUTES = 10;          // how long a code stays valid
const CODE_MAX_ATTEMPTS = 5;      // wrong guesses before a code is burned
const RESEND_COOLDOWN_SECONDS = 60;
const BCRYPT_ROUNDS = 12;

const db = {
    findByEmail: promisify(User.findByEmail),
    findById: promisify(User.findById),
    findByPhone: promisify(User.findByPhone),
    create: promisify(User.create),
    replaceUnverified: promisify(User.replaceUnverified),
    markEmailVerified: promisify(User.markEmailVerified),
    setPassword: promisify(User.setPassword),
    replaceCode: promisify(EmailCode.replace),
    latestCode: promisify(EmailCode.latest),
    addAttempt: promisify(EmailCode.addAttempt),
    clearCodes: promisify(EmailCode.clear),
};

class AuthError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const clean = (value) => (typeof value === 'string' ? value.trim() : '');

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// bcrypt only reads the first 72 bytes, so longer passwords are refused
// rather than silently truncated.
const passwordProblem = (password) => {
    if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
    if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 characters';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one letter and one number';
    return null;
};

// Codes are stored as an HMAC bound to the user and purpose, so a leaked
// email_codes row cannot be replayed against another account or flow.
const hashCode = (userId, purpose, code) =>
    crypto.createHmac('sha256', JWT_SECRET).update(`${purpose}:${userId}:${code}`).digest('hex');

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * Issues and emails a fresh code. Respects the resend cooldown unless `force`
 * is set; returns false (without sending) while the cooldown is running.
 */
const issueCode = async (user, purpose, { force = false } = {}) => {
    if (!force) {
        const [last] = await db.latestCode(user.id, purpose);
        if (last && parseFloat(last.age_seconds) < RESEND_COOLDOWN_SECONDS) return false;
    }
    const code = generateCode();
    await db.replaceCode(user.id, purpose, hashCode(user.id, purpose, code), CODE_MINUTES);
    await sendAuthCodeEmail(user.email, user.name, code, purpose, CODE_MINUTES);
    return true;
};

/**
 * Checks a submitted code. Wrong guesses count against the code; after
 * CODE_MAX_ATTEMPTS it stops working and a new one must be requested.
 */
const checkCode = async (user, purpose, submitted) => {
    const code = clean(submitted);
    if (!/^[0-9]{6}$/.test(code)) throw new AuthError(400, 'Enter the 6-digit code from your email');

    const [row] = await db.latestCode(user.id, purpose);
    if (!row || !row.is_live) throw new AuthError(400, 'This code has expired. Request a new one.', { expired: true });
    if (row.attempts >= CODE_MAX_ATTEMPTS) throw new AuthError(400, 'Too many incorrect attempts. Request a new code.', { expired: true });

    const expected = Buffer.from(row.code_hash, 'hex');
    const actual = Buffer.from(hashCode(user.id, purpose, code), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        await db.addAttempt(row.id);
        const left = CODE_MAX_ATTEMPTS - row.attempts - 1;
        throw new AuthError(400, left > 0
            ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
            : 'Too many incorrect attempts. Request a new code.', { expired: left <= 0 });
    }
    await db.clearCodes(user.id, purpose);
};

/** Records the sign-in and returns the session the SPA stores. */
const startSession = (req, user) => {
    const clientIP = requestIp.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    User.updateLoginInfo(user.id, clientIP, (err) => {
        if (err) console.error('Error updating login info:', err.message);
    });
    User.createLoginSession(user.id, clientIP, userAgent, 'Unknown', (err) => {
        if (err) console.error('Error creating login session:', err.message);
    });

    return {
        token: generateToken(user.id),
        userId: user.id,
        user: { name: user.name, email: user.email, accountType: user.account_type }
    };
};

// Wraps a handler so thrown AuthErrors become JSON responses and anything
// else is logged in full but reported in outline.
const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof AuthError) {
            return res.status(err.status).json({ error: err.message, ...err.extra });
        }
        if (err.code === 'ER_DUP_ENTRY') {
            // Two sign-ups for the same email or phone racing each other.
            return res.status(409).json({ error: 'An account with this email or phone number already exists' });
        }
        console.error(`Auth error (${req.path}):`, err.message);
        if (/email is not configured|smtp|greeting|ECONN|EAUTH|unauthorized ip/i.test(err.message)) {
            return res.status(503).json({ error: "We couldn't send the email right now. Please try again in a few minutes." });
        }
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// ── Handlers ───────────────────────────────────────────────────────────────

const AuthController = {
    /**
     * POST /api/auth/register
     * Creates an unverified account and emails a verification code.
     */
    register: handle(async (req, res) => {
        const accountType = req.body.accountType === 'business' ? 'business' : req.body.accountType === 'personal' ? 'personal' : null;
        const name = clean(req.body.name);
        const email = normalizeEmail(req.body.email);
        const phone = clean(req.body.phone).replace(/[\s-]/g, '');
        const password = req.body.password;
        const company = clean(req.body.company);
        const gstin = clean(req.body.gstin).toUpperCase();
        const role = clean(req.body.role);

        if (!accountType) throw new AuthError(400, 'Choose a Personal or Business account');
        if (name.length < 2 || name.length > 100) throw new AuthError(400, 'Enter your full name');
        if (!validateEmail(email) || email.length > 255) throw new AuthError(400, 'Enter a valid email address');
        if (!validatePhone(phone)) throw new AuthError(400, 'Enter a valid phone number (digits only, 7 to 15)');
        const pwProblem = passwordProblem(password);
        if (pwProblem) throw new AuthError(400, pwProblem);
        if (req.body.acceptTerms !== true) throw new AuthError(400, 'Please accept the Terms of Service and Privacy Policy');

        if (accountType === 'business') {
            if (company.length < 2 || company.length > 100) throw new AuthError(400, 'Enter your business name');
            if (gstin && !GSTIN_RE.test(gstin)) throw new AuthError(400, 'Enter a valid 15-character GSTIN, or leave it blank');
            if (role.length > 50) throw new AuthError(400, 'Job title must be at most 50 characters');
        }

        const details = {
            accountType,
            name,
            email,
            phone,
            passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
            company: accountType === 'business' ? company : null,
            gstin: accountType === 'business' && gstin ? gstin : null,
            role: accountType === 'business' && role ? role : null,
        };

        const [phoneOwner] = await db.findByPhone(phone);
        if (phoneOwner && phoneOwner.email !== email) {
            throw new AuthError(409, 'This phone number is already linked to another account');
        }

        const [existing] = await db.findByEmail(email);
        let user;
        if (existing) {
            if (existing.isemailverified) {
                throw new AuthError(409, existing.password_hash
                    ? 'An account with this email already exists. Sign in instead.'
                    : 'An account with this email already exists. Use "Forgot password" to set a password.');
            }
            // Signed up before but never verified: take the new details.
            await db.replaceUnverified(existing.id, details);
            user = { ...existing, name };
        } else {
            const result = await db.create(details);
            user = { id: result.insertId, email, name };
        }

        await issueCode(user, 'verify', { force: true });
        res.status(201).json({ message: 'Account created. Check your email for a verification code.', email });
    }),

    /**
     * POST /api/auth/verify-email
     * Confirms the code and signs the user in.
     */
    verifyEmail: handle(async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const [user] = await db.findByEmail(email);
        if (!user) throw new AuthError(400, 'This code has expired. Request a new one.', { expired: true });
        if (user.isemailverified) throw new AuthError(400, 'This email is already verified. Sign in instead.', { alreadyVerified: true });

        await checkCode(user, 'verify', req.body.code);
        await db.markEmailVerified(user.id);
        res.json({ message: 'Email verified', ...startSession(req, user) });
    }),

    /**
     * POST /api/auth/resend-code
     * Sends a new verification or reset code, subject to the cooldown. Always
     * answers the same way so it cannot be used to discover accounts.
     */
    resendCode: handle(async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const purpose = req.body.purpose === 'reset' ? 'reset' : 'verify';
        const [user] = await db.findByEmail(email);

        const eligible = user && (purpose === 'reset' || !user.isemailverified);
        if (eligible) {
            const sent = await issueCode(user, purpose);
            if (!sent) throw new AuthError(429, `Please wait a minute before requesting another code.`);
        }
        res.json({ message: 'If that email has an account, a new code is on its way.' });
    }),

    /**
     * POST /api/auth/login
     */
    login: handle(async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        if (!email || !password) throw new AuthError(400, 'Enter your email and password');

        const [user] = await db.findByEmail(email);

        // Accounts from the BUTTR ID period have no password until their owner
        // sets one through "Forgot password".
        const ok = user && user.password_hash && await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            throw new AuthError(401, user && !user.password_hash
                ? 'This account has no password yet. Use "Forgot password" to set one.'
                : 'Incorrect email or password');
        }

        if (!user.isemailverified) {
            await issueCode(user, 'verify');
            throw new AuthError(403, 'Please verify your email first. We\'ve sent you a code.', { needsVerification: true, email });
        }

        res.json({ message: 'Signed in', ...startSession(req, user) });
    }),

    /**
     * POST /api/auth/forgot-password
     * Same response whether or not the account exists.
     */
    forgotPassword: handle(async (req, res) => {
        const email = normalizeEmail(req.body.email);
        if (!validateEmail(email)) throw new AuthError(400, 'Enter a valid email address');

        const [user] = await db.findByEmail(email);
        if (user) await issueCode(user, 'reset');
        res.json({ message: 'If that email has an account, we\'ve sent a reset code.', email });
    }),

    /**
     * POST /api/auth/reset-password
     * Sets a new password. Receiving the code also proves the inbox, so the
     * email counts as verified afterwards.
     */
    resetPassword: handle(async (req, res) => {
        const email = normalizeEmail(req.body.email);
        const pwProblem = passwordProblem(req.body.password);
        if (pwProblem) throw new AuthError(400, pwProblem);

        const [user] = await db.findByEmail(email);
        if (!user) throw new AuthError(400, 'This code has expired. Request a new one.', { expired: true });

        await checkCode(user, 'reset', req.body.code);
        await db.setPassword(user.id, await bcrypt.hash(req.body.password, BCRYPT_ROUNDS));
        if (!user.isemailverified) await db.markEmailVerified(user.id);
        res.json({ message: 'Password updated', ...startSession(req, user) });
    }),

    /**
     * POST /api/auth/change-password (signed in)
     */
    changePassword: handle(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const [user] = await db.findById(req.user.userId);
        if (!user) throw new AuthError(404, 'Account not found');

        if (!user.password_hash || !(await bcrypt.compare(String(currentPassword || ''), user.password_hash))) {
            throw new AuthError(400, 'Your current password is incorrect');
        }
        const pwProblem = passwordProblem(newPassword);
        if (pwProblem) throw new AuthError(400, pwProblem);

        await db.setPassword(user.id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
        res.json({ message: 'Password changed' });
    }),

    /**
     * POST /api/auth/logout — sessions are bearer tokens held by the client,
     * so signing out is the client discarding its token.
     */
    logout: (req, res) => {
        res.json({ message: 'Signed out' });
    }
};

module.exports = AuthController;
