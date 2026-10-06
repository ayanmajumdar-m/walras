const requestIp = require('request-ip');
const connection = require('../config/db');

/**
 * Records an admin action in admin_audit_logs. Never throws: a failed audit
 * write is logged, but it must not undo or block the action itself.
 *
 *   audit(req, 'user.suspend', 'user', userId, { reason })
 */
const audit = (req, action, targetType = null, targetId = null, metadata = {}) => {
    const admin = req.admin || {};
    connection.query(
        `INSERT INTO admin_audit_logs (admin_id, admin_username, action, target_type, target_id, metadata, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            admin.adminId || null,
            admin.username || null,
            action,
            targetType,
            targetId == null ? null : String(targetId),
            JSON.stringify(metadata || {}),
            requestIp.getClientIp(req) || null,
        ],
        (err) => {
            if (err) console.error(`Audit log failed for ${action}:`, err.message);
        }
    );
};

module.exports = audit;

/**
 * Route-level audit for existing handlers: records the action once the
 * response has gone out, and only if it succeeded.
 *
 *   router.delete('/hosting/:id', auditRoute('hosting.delete', 'hosting', (req) => req.params.id), handler)
 */
audit.route = (action, targetType, getTargetId = () => null, getMeta = () => ({})) => (req, res, next) => {
    res.on('finish', () => {
        if (res.statusCode < 400) {
            let targetId = null;
            let meta = {};
            try { targetId = getTargetId(req); meta = getMeta(req); } catch { /* best effort */ }
            audit(req, action, targetType, targetId, meta);
        }
    });
    next();
};
