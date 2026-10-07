const jwt = require('jsonwebtoken');
const connection = require('../config/db');
const { JWT_SECRET } = process.env;
const { accessFor, membership } = require('./team');

/*
  Suspended customers are refused on every request, not just at sign-in.
  The status is cached briefly so this is not a query per request; admin
  suspend/unsuspend calls forgetUserStatus() so it takes effect at once.
*/
const STATUS_TTL_MS = 30 * 1000;
const statusCache = new Map(); // userId -> { suspended, reason, at }

const userStatus = (userId) => new Promise((resolve) => {
    const hit = statusCache.get(userId);
    if (hit && Date.now() - hit.at < STATUS_TTL_MS) return resolve(hit);
    connection.query('SELECT suspended_at, suspension_reason FROM users WHERE id = ?', [userId], (err, rows) => {
        if (err) return resolve({ suspended: false }); // never lock everyone out on a DB hiccup
        const row = rows && rows[0];
        const entry = { suspended: Boolean(row && row.suspended_at), reason: row?.suspension_reason || null, at: Date.now() };
        statusCache.set(userId, entry);
        resolve(entry);
    });
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        // Admin tokens are signed with the same secret; they are not customer sessions.
        if (err || !user || !user.userId || user.typ === 'admin') {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        const status = await userStatus(user.userId);
        if (status.suspended) {
            return res.status(403).json({
                error: `Your account is suspended${status.reason ? `: ${status.reason}` : ''}. Contact support@walras.net.`,
                suspended: true,
            });
        }

        // Working in a team owner's account (utils/team.js).
        const header = req.headers['x-walras-account'];
        if (header !== undefined && header !== '' && Number(header) !== Number(user.userId)) {
            const ownerId = Number(header);
            const needed = accessFor(req.originalUrl);
            if (!Number.isInteger(ownerId) || ownerId <= 0) {
                return res.status(400).json({ error: 'Invalid account.' });
            }
            if (!needed) {
                return res.status(403).json({ error: "This isn't available while working in a team account.", teamAccessDenied: true });
            }
            const role = await membership(ownerId, user.userId);
            if (!role) {
                return res.status(403).json({ error: 'You no longer have access to that account.', teamAccessRevoked: true });
            }
            if (needed === 'admin' && role !== 'admin') {
                return res.status(403).json({ error: 'Only account admins can do this.', teamAccessDenied: true });
            }
            // Write: use everything, delete nothing.
            if (role === 'write' && req.method === 'DELETE') {
                return res.status(403).json({ error: "Your Write access can't delete. Ask an account admin.", teamAccessDenied: true });
            }
            const ownerStatus = await userStatus(ownerId);
            if (ownerStatus.suspended) {
                return res.status(403).json({ error: 'That account is suspended.', teamAccessRevoked: true });
            }
            // Everything downstream scopes by userId, so it now acts on the owner's account.
            req.user = { ...user, userId: ownerId, actorId: user.userId, teamRole: role };
            return next();
        }

        req.user = user;
        next();
    });
};

authenticateToken.forgetUserStatus = (userId) => statusCache.delete(Number(userId));

module.exports = authenticateToken;
