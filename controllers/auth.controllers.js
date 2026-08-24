/**
 * Sign in with BUTTR ID.
 *
 * Buttr Cloud keeps its own short-lived session token — every protected route
 * and every controller already reads `req.user.userId` from it — but that
 * token is now only ever minted after BUTTR ID has said who the person is.
 * There is no local password, no local OTP and no local password reset.
 */

const jwt = require('jsonwebtoken');
const requestIp = require('request-ip');
const dotenv = require('dotenv');
const User = require('../model/User.model');
const buttrId = require('../services/buttrIdService');

dotenv.config();
const { JWT_SECRET } = process.env;

// jsonwebtoken rejects `expiresIn: undefined` outright, so an unset variable
// used to throw on every sign-in rather than falling back to a default.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');

const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * Only same-site paths may be returned to. An absolute URL here would turn the
 * callback into an open redirect, which is exactly the tool a phisher wants
 * from a login endpoint.
 */
const safeReturnTo = (value) => {
    if (typeof value !== 'string') return '/dashboard';
    if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
    return value;
};

const failureRedirect = (res, message) =>
    res.redirect(`${CLIENT_URL}/login?error=${encodeURIComponent(message)}`);

/**
 * Records the sign-in and hands the session token to the SPA.
 *
 * The token goes in the URL fragment rather than the query string: fragments
 * are never sent to a server, so it stays out of access logs and out of any
 * Referer header.
 */
const finishSignIn = (req, res, user, returnTo) => {
    const clientIP = requestIp.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    User.updateLoginInfo(user.id, clientIP, (err) => {
        if (err) console.error('Error updating login info:', err);
    });
    User.createLoginSession(user.id, clientIP, userAgent, 'Unknown', (err) => {
        if (err) console.error('Error creating login session:', err);
    });

    const token = generateToken(user.id);
    const target = new URLSearchParams({
        token,
        userId: String(user.id),
        returnTo: safeReturnTo(returnTo)
    });
    return res.redirect(`${CLIENT_URL}/auth/callback#${target.toString()}`);
};

/**
 * Turns a set of BUTTR ID claims into a Buttr Cloud account.
 *
 * The subject identifier is the key, never the email address — BUTTR ID issues
 * a different `sub` to every client for the same person, and an account there
 * may have no email at all.
 *
 * Every account starts here. There is no path that adopts a pre-BUTTR row:
 * the users table is BUTTR-ID-only by construction.
 */
const resolveAccount = (identity, callback) => {
    User.findByButtrSub(identity.buttrSub, (err, rows) => {
        if (err) return callback(err);

        if (rows && rows.length > 0) {
            const user = rows[0];
            return User.syncFromButtrId(user.id, identity, (syncErr) => {
                if (syncErr) console.error('Error syncing BUTTR ID profile:', syncErr);
                callback(null, user);
            });
        }

        User.createFromButtrId(identity, (createErr, result) => {
            if (createErr) return callback(createErr);
            callback(null, { id: result.insertId });
        });
    });
};

const AuthController = {
    /**
     * Step 1 — send the browser to BUTTR ID.
     */
    start: async (req, res) => {
        try {
            const url = await buttrId.buildAuthorizationUrl(safeReturnTo(req.query.returnTo));
            return res.redirect(url);
        } catch (error) {
            console.error('BUTTR ID authorize error:', error.message);
            return failureRedirect(res, 'Sign-in is temporarily unavailable');
        }
    },

    /**
     * Step 2 — BUTTR ID sends the browser back with an authorization code.
     */
    callback: async (req, res) => {
        const { code, state, error, error_description: errorDescription } = req.query;

        if (error) {
            console.warn('BUTTR ID returned an error:', error, errorDescription || '');
            return failureRedirect(res, error === 'access_denied' ? 'Sign-in was cancelled' : 'Sign-in failed');
        }

        const request = buttrId.takePending(state);
        if (!request) {
            return failureRedirect(res, 'This sign-in link has expired. Please try again.');
        }
        if (!code) {
            return failureRedirect(res, 'Sign-in failed');
        }

        try {
            const tokens = await buttrId.exchangeCode(code, request.verifier);
            const claims = await buttrId.verifyIdToken(tokens.id_token, request.nonce);
            const userinfo = await buttrId.fetchUserInfo(tokens.access_token);

            const identity = {
                buttrSub: claims.sub,
                buttrHandle: userinfo.buttr_id || claims.buttr_id || null,
                name: userinfo.name || claims.name || userinfo.buttr_id || 'Buttr Cloud user',
                email: userinfo.email || null
            };

            return resolveAccount(identity, (accountErr, user) => {
                if (accountErr) {
                    // Logged in full, reported in outline — a database error
                    // must never be echoed into the browser.
                    console.error('BUTTR ID account resolution failed:', accountErr.message);
                    return failureRedirect(res, 'We could not open your Buttr Cloud account. Please contact support.');
                }
                return finishSignIn(req, res, user, request.returnTo);
            });
        } catch (err) {
            console.error('BUTTR ID callback failed:', err.response?.data || err.message);
            return failureRedirect(res, 'Sign-in failed. Please try again.');
        }
    },

    /**
     * Ends the Buttr Cloud session only. The BUTTR ID session is separate and
     * stays active — signing out of one site should not sign you out of your
     * identity provider.
     */
    logout: (req, res) => {
        res.json({
            message: 'Signed out',
            buttrAccountUrl: buttrId.ACCOUNT_URL
        });
    },

    /**
     * Where the frontend points "Manage your BUTTR ID" — password, sessions,
     * connected apps and sign-in methods all live there, not here.
     */
    config: (req, res) => {
        res.json({
            issuer: buttrId.ISSUER,
            accountUrl: buttrId.ACCOUNT_URL,
            scopes: buttrId.SCOPES
        });
    }
};

module.exports = AuthController;
