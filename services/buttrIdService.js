/**
 * BUTTR ID — OpenID Connect relying party.
 *
 * Walras Cloud does not authenticate anyone itself. It hands the browser to
 * BUTTR ID, and BUTTR ID hands back a signed assertion of who the person is.
 * Nothing in this file ever sees a password.
 *
 * Endpoints are read from the issuer's discovery document rather than
 * hard-coded, so a moved endpoint or a rotated signing key needs no change
 * here.
 */

const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const ISSUER = (process.env.BUTTR_ISSUER || 'https://idcloud.buttrcrew.com').replace(/\/+$/, '');
const CLIENT_ID = process.env.BUTTR_CLIENT_ID || 'buttr-cloud';
const CLIENT_SECRET = process.env.BUTTR_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.BUTTR_REDIRECT_URI || 'https://buttr.cloud/api/auth/buttr/callback';
const SCOPES = process.env.BUTTR_SCOPES || 'openid profile email';

// BUTTR ID is two deployments, not one: the Go issuer that serves /oauth2/*
// and the Next.js app that serves the pages people actually look at —
// /signin, /consent and /account. The account page is on the second one, so
// linking to `${ISSUER}/account` reaches a backend with no such route.
// This mirrors BUTTR_PUBLIC_WEB on the identity side.
const WEB_URL = (process.env.BUTTR_WEB_URL || 'https://id.buttrcrew.com').replace(/\/+$/, '');
const ACCOUNT_URL = `${WEB_URL}/account`;

// How long a started sign-in may sit unfinished before its PKCE verifier is
// discarded. Long enough to read a verification code, short enough that a
// leaked state value is worthless by the time anyone tries to use it.
const PENDING_TTL_MS = 10 * 60 * 1000;

const assertConfigured = () => {
    if (!CLIENT_ID || !REDIRECT_URI) {
        throw new Error('BUTTR ID is not configured: BUTTR_CLIENT_ID or BUTTR_REDIRECT_URI missing.');
    }
};

/* -------------------------------------------------------------------------- */
/* Discovery                                                                   */
/* -------------------------------------------------------------------------- */

let discoveryCache = null;
let discoveryFetchedAt = 0;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

const getDiscovery = async () => {
    if (discoveryCache && Date.now() - discoveryFetchedAt < DISCOVERY_TTL_MS) {
        return discoveryCache;
    }
    const { data } = await axios.get(`${ISSUER}/.well-known/openid-configuration`, { timeout: 10000 });
    discoveryCache = data;
    discoveryFetchedAt = Date.now();
    return discoveryCache;
};

let jwksCache = null;
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;

const getJwks = async (jwksUri, { force = false } = {}) => {
    if (!force && jwksCache && Date.now() - jwksFetchedAt < JWKS_TTL_MS) {
        return jwksCache;
    }
    const { data } = await axios.get(jwksUri, { timeout: 10000 });
    jwksCache = data;
    jwksFetchedAt = Date.now();
    return jwksCache;
};

/* -------------------------------------------------------------------------- */
/* Pending authorizations                                                      */
/* -------------------------------------------------------------------------- */

// state -> { verifier, nonce, returnTo, at }
//
// In-process, which is correct for the single Node instance that also serves
// the React build. Behind more than one instance this must move to Redis or a
// table, or a user will come back to an instance that never started their
// sign-in and be told the state is unrecognised.
const pending = new Map();

const sweepPending = () => {
    const cutoff = Date.now() - PENDING_TTL_MS;
    for (const [state, entry] of pending) {
        if (entry.at < cutoff) pending.delete(state);
    }
};

const randomId = () => crypto.randomBytes(32).toString('base64url');

const pkce = () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
};

/**
 * Builds the URL to send the browser to, and remembers what must be checked
 * when it comes back.
 */
const buildAuthorizationUrl = async (returnTo) => {
    assertConfigured();
    sweepPending();

    const discovery = await getDiscovery();
    const { verifier, challenge } = pkce();

    // state defends the callback against CSRF; nonce binds the ID token to
    // this particular request. Both are verified on the way back.
    const state = randomId();
    const nonce = randomId();
    pending.set(state, { verifier, nonce, returnTo, at: Date.now() });

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        state,
        nonce,
        code_challenge: challenge,
        code_challenge_method: 'S256'
    });

    return `${discovery.authorization_endpoint}?${params.toString()}`;
};

/**
 * Consumes a state value. An unrecognised or expired one means this callback
 * did not come from a sign-in we started, which is what stops an attacker
 * injecting their own authorization code into someone else's browser.
 */
const takePending = (state) => {
    if (!state) return null;
    const entry = pending.get(state);
    if (!entry) return null;
    pending.delete(state);
    if (Date.now() - entry.at > PENDING_TTL_MS) return null;
    return entry;
};

/* -------------------------------------------------------------------------- */
/* Token exchange                                                              */
/* -------------------------------------------------------------------------- */

const exchangeCode = async (code, verifier) => {
    assertConfigured();
    const discovery = await getDiscovery();

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        client_id: CLIENT_ID
    });
    if (CLIENT_SECRET) {
        body.set('client_secret', CLIENT_SECRET);
    }

    const { data } = await axios.post(discovery.token_endpoint, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
    });
    return data;
};

/**
 * Validates the ID token: signature against the issuer's published keys, then
 * issuer, audience, expiry and nonce.
 *
 * Every one of these checks matters. Without the signature check a JWT is just
 * base64 that anyone can write.
 */
const verifyIdToken = async (idToken, expectedNonce) => {
    const discovery = await getDiscovery();

    const [headerB64, payloadB64, signatureB64] = String(idToken).split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
        throw new Error('malformed ID token');
    }

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (header.alg !== 'RS256') throw new Error(`unexpected ID token algorithm ${header.alg}`);

    let jwks = await getJwks(discovery.jwks_uri);
    let jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) {
        // An unknown kid usually means the issuer rotated its signing key since
        // we last cached the set, so fetch it once more before giving up.
        jwks = await getJwks(discovery.jwks_uri, { force: true });
        jwk = jwks.keys.find((k) => k.kid === header.kid);
    }
    if (!jwk) throw new Error(`no signing key published for kid ${header.kid}`);

    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signatureValid = crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${headerB64}.${payloadB64}`),
        key,
        Buffer.from(signatureB64, 'base64url')
    );
    if (!signatureValid) throw new Error('ID token signature is invalid');

    if (claims.iss !== discovery.issuer) throw new Error(`unexpected issuer ${claims.iss}`);

    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(CLIENT_ID)) throw new Error('ID token was issued for a different client');

    if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('ID token has expired');
    if (claims.nonce !== expectedNonce) throw new Error('ID token nonce mismatch');

    return claims;
};

/**
 * The authoritative, current view of a user's claims. The ID token proves who
 * authenticated; userinfo is what to store and display.
 */
const fetchUserInfo = async (accessToken) => {
    const discovery = await getDiscovery();
    const { data } = await axios.get(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000
    });
    return data;
};

module.exports = {
    ISSUER,
    WEB_URL,
    ACCOUNT_URL,
    SCOPES,
    assertConfigured,
    buildAuthorizationUrl,
    takePending,
    exchangeCode,
    verifyIdToken,
    fetchUserInfo
};
