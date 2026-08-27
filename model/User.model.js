const connection = require('../config/db');

const User = {
    // Identity lives in BUTTR ID. The only thing that identifies an account
    // here is the subject identifier BUTTR ID issues for this client — it is
    // stable for a person, and deliberately different from what any other
    // BUTTR service sees for the same person.
    findByButtrSub: (buttrSub, callback) => {
        const query = 'SELECT * FROM users WHERE buttr_sub = ?';
        connection.query(query, [buttrSub], callback);
    },

    createFromButtrId: (identity, callback) => {
        const { buttrSub, buttrHandle, name, email, phone } = identity;
        // true/false, not 1/0: MySQL coerced integers into BOOLEAN columns,
        // PostgreSQL refuses with "is of type boolean but expression is of
        // type integer".
        const query = `
        INSERT INTO users (buttr_sub, buttr_handle, name, email, phone, isVerified, isEmailVerified)
        VALUES (?, ?, ?, ?, ?, true, ?)`;
        connection.query(query, [buttrSub, buttrHandle, name, email || null, phone || null, Boolean(email)], callback);
    },

    // Name and email are BUTTR ID's to change, so refresh the local copy on
    // every sign-in rather than letting it drift.
    syncFromButtrId: (id, identity, callback) => {
        const { buttrHandle, name, email } = identity;
        const query = `
        UPDATE users
        SET buttr_handle = ?, name = ?, email = ?, isEmailVerified = ?
        WHERE id = ?`;
        connection.query(query, [buttrHandle, name, email || null, Boolean(email), id], callback);
    },

    // No findByEmail / findByPhone. Nothing may look an account up by contact
    // detail: buttr_sub is the identity, and an account can have no email.

    viewData: (id, callback) => {
        const query = 'SELECT id, name, email, phone, company, role, address, buttr_handle FROM users WHERE id = ?';
        connection.query(query, [id], callback);
    },
    updateData: (id, userData, callback) => {
        // name and email are not updatable here — they are owned by BUTTR ID
        // and overwritten from it on the next sign-in.
        const { phone, company, role, address } = userData;
        const query = 'UPDATE users SET phone = ?, company = ?, role = ?, address = ? WHERE id = ?';
        connection.query(query, [phone, company, role, address, id], callback);
    },

    // Update login information
    updateLoginInfo: (id, ipAddress, callback) => {
        const query = 'UPDATE users SET lastLoginAt = NOW(), lastLoginIP = ? WHERE id = ?';
        connection.query(query, [ipAddress, id], callback);
    },

    // Create login session
    createLoginSession: (userId, ipAddress, userAgent, location, callback) => {
        // Generate a unique session token
        const sessionToken = require('crypto').randomBytes(32).toString('hex');
        const query = 'INSERT INTO user_sessions (user_id, ip_address, user_agent, location, session_token) VALUES (?, ?, ?, ?, ?)';
        connection.query(query, [userId, ipAddress, userAgent, location, sessionToken], callback);
    },

    // Get user sessions
    getUserSessions: (userId, callback) => {
        const query = 'SELECT * FROM user_sessions WHERE user_id = ? ORDER BY login_time DESC';
        connection.query(query, [userId], callback);
    },

    // Get all active sessions
    getAllActiveSessions: (callback) => {
        const query = 'SELECT us.*, u.name, u.email FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.is_active = true ORDER BY us.login_time DESC';
        connection.query(query, callback);
    },

    // Get unique IP addresses for a user
    getUserIPs: (userId, callback) => {
        const query = 'SELECT DISTINCT ip_address, location, COUNT(*) as login_count, MAX(login_time) as last_login FROM user_sessions WHERE user_id = ? GROUP BY ip_address, location ORDER BY last_login DESC';
        connection.query(query, [userId], callback);
    },

    // Logout session
    logoutSession: (sessionId, callback) => {
        const query = 'UPDATE user_sessions SET is_active = false, logout_time = NOW() WHERE id = ?';
        connection.query(query, [sessionId], callback);
    },

    // Validate session token
    validateSessionToken: (sessionToken, callback) => {
        const query = 'SELECT us.*, u.name, u.email FROM user_sessions us JOIN users u ON us.user_id = u.id WHERE us.session_token = ? AND us.is_active = true';
        connection.query(query, [sessionToken], callback);
    },

    // Logout session by token
    logoutSessionByToken: (sessionToken, callback) => {
        const query = 'UPDATE user_sessions SET is_active = false, logout_time = NOW() WHERE session_token = ?';
        connection.query(query, [sessionToken], callback);
    },

    // Get user with full details including login info
    getUserWithDetails: (id, callback) => {
        const query = `SELECT u.*, 
            (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.id) as total_logins,
            (SELECT COUNT(DISTINCT ip_address) FROM user_sessions WHERE user_id = u.id) as unique_ips,
            (SELECT ip_address FROM user_sessions WHERE user_id = u.id ORDER BY login_time DESC LIMIT 1) as current_ip
            FROM users u WHERE u.id = ?`;
        connection.query(query, [id], callback);
    }

};

module.exports = User;
