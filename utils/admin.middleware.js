const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

const authenticateAdminToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Authentication token is required' });
        }

        jwt.verify(token, JWT_SECRET, (err, admin) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            req.admin = admin;
            next();
        });
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Middleware to check if admin has owner access
const requireOwnerAccess = (req, res, next) => {
    if (req.admin.access !== 'owner') {
        return res.status(403).json({ error: 'Owner access required' });
    }
    next();
};

// Middleware to check if admin has billing or owner access
const requireBillingAccess = (req, res, next) => {
    if (!['billing', 'owner'].includes(req.admin.access)) {
        return res.status(403).json({ error: 'Billing or owner access required' });
    }
    next();
};

module.exports = {
    authenticateAdminToken,
    requireOwnerAccess,
    requireBillingAccess
};
