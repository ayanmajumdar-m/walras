const jwt = require('jsonwebtoken');
const connection = require('../config/db');
const { permissionsFor } = require('./adminRbac');

const { JWT_SECRET } = process.env;

/**
 * Admin sessions. The token must be an admin token (typ: 'admin'); customer
 * tokens are signed with the same secret and must never pass here. The admin
 * is re-read on every request so a deleted, deactivated or re-roled admin
 * takes effect immediately rather than when their token expires.
 */
const authenticateAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication token is required' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err || !decoded || decoded.typ !== 'admin' || !decoded.adminId) {
            return res.status(401).json({ error: 'Invalid or expired admin session' });
        }

        connection.query(
            'SELECT id, username, full_name, role, access, is_active FROM admins WHERE id = ?',
            [decoded.adminId],
            async (dbErr, rows) => {
                if (dbErr) return res.status(500).json({ error: 'Database error' });
                const admin = rows && rows[0];
                if (!admin || admin.is_active === false) {
                    return res.status(401).json({ error: 'This admin account is no longer active' });
                }
                // Rows created outside the app (create-admin.js) may predate roles.
                const role = admin.role || (admin.access === 'owner' ? 'super_admin' : 'finance');
                try {
                    req.admin = {
                        adminId: admin.id,
                        username: admin.username,
                        fullName: admin.full_name,
                        role,
                        permissions: await permissionsFor(role),
                    };
                    next();
                } catch (permErr) {
                    console.error('Admin permission lookup failed:', permErr.message);
                    res.status(500).json({ error: 'Could not load admin permissions' });
                }
            }
        );
    });
};

// Any one of the listed permissions is enough.
const requirePermission = (...perms) => (req, res, next) => {
    const have = req.admin?.permissions || [];
    if (perms.some((p) => have.includes(p))) return next();
    return res.status(403).json({ error: 'You do not have permission to do this' });
};

module.exports = { authenticateAdminToken, requirePermission };
