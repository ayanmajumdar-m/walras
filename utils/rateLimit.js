const requestIp = require('request-ip');

/**
 * A small fixed-window rate limiter for the auth endpoints.
 *
 * In memory, so the counts reset when the process restarts and are per
 * instance — enough to stop someone hammering login or guessing codes from
 * one machine, without adding Redis for it.
 *
 * keyFn picks what to count by; the default is the client IP. Login also keys
 * on the email address so one IP cannot spray many accounts and many IPs
 * cannot hammer one account.
 */
const rateLimit = ({ windowMs, max, message, keyFn }) => {
    const hits = new Map();

    // Drop expired windows now and then so the map cannot grow forever.
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const key = (keyFn ? keyFn(req) : null) || requestIp.getClientIp(req) || 'unknown';
        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }

        entry.count += 1;
        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ error: message || 'Too many attempts. Please try again later.' });
        }
        next();
    };
};

module.exports = rateLimit;
