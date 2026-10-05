const connection = require('../config/db');

const User = {
    // Accounts are keyed on email. Callers lowercase it before it gets here,
    // and the column is UNIQUE, so one address means one account.
    findByEmail: (email, callback) => {
        connection.query('SELECT * FROM users WHERE email = ?', [email], callback);
    },

    findById: (id, callback) => {
        connection.query('SELECT * FROM users WHERE id = ?', [id], callback);
    },

    findByPhone: (phone, callback) => {
        connection.query('SELECT id, email FROM users WHERE phone = ?', [phone], callback);
    },

    // New accounts start unverified; verifying the email flips both flags.
    create: (data, callback) => {
        const { accountType, name, email, phone, passwordHash, company, gstin, role } = data;
        const query = `
        INSERT INTO users (account_type, name, email, phone, password_hash, company, gstin, role, isVerified, isEmailVerified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false)`;
        connection.query(query, [accountType, name, email, phone, passwordHash, company, gstin, role], callback);
    },

    // Someone signing up again before verifying: take the latest details.
    replaceUnverified: (id, data, callback) => {
        const { accountType, name, phone, passwordHash, company, gstin, role } = data;
        const query = `
        UPDATE users
        SET account_type = ?, name = ?, phone = ?, password_hash = ?, company = ?, gstin = ?, role = ?
        WHERE id = ? AND isEmailVerified = false`;
        connection.query(query, [accountType, name, phone, passwordHash, company, gstin, role, id], callback);
    },

    markEmailVerified: (id, callback) => {
        connection.query('UPDATE users SET isEmailVerified = true, isVerified = true WHERE id = ?', [id], callback);
    },

    setPassword: (id, passwordHash, callback) => {
        connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id], callback);
    },

    viewData: (id, callback) => {
        const query = `
        SELECT id, account_type, name, email, phone, company, gstin, role, address, isEmailVerified
        FROM users WHERE id = ?`;
        connection.query(query, [id], callback);
    },
    updateData: (id, userData, callback) => {
        // email is not updatable here: changing it would need a fresh
        // verification of the new address.
        const { name, phone, company, gstin, role, address } = userData;
        const query = 'UPDATE users SET name = ?, phone = ?, company = ?, gstin = ?, role = ?, address = ? WHERE id = ?';
        connection.query(query, [name, phone, company, gstin, role, address, id], callback);
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
