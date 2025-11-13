const connection = require('../config/db');

const User = {
    create: (userData, callback) => {
        const { name, email, password, company, role, address, phone, emailOtp } = userData;
        const query = 'INSERT INTO users (name, email, password, company, role, address, phone, emailOtp, isVerified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false)';
        connection.query(query, [name, email, password, company, role, address, phone, emailOtp], callback);
    },

    setResetToken: (email, token, expires, callback) => {
        const query = 'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?';
        connection.query(query, [token, expires, email], callback);
    },

    findByResetToken: (token, callback) => {
        const query = 'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW()';
        connection.query(query, [token], callback);
    },

    clearResetToken: (userId, callback) => {
        const query = 'UPDATE users SET resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?';
        connection.query(query, [userId], callback);
    },

    verifyEmail: (token, callback) => {
        const query = 'UPDATE users SET isVerified = true, emailOtp = NULL WHERE emailOtp = ?';
        connection.query(query, [token], callback);
    },

    findByVerificationToken: (token, callback) => {
        const query = 'SELECT * FROM users WHERE emailOtp = ?';
        connection.query(query, [token], callback);
    },
    verifyEmailOtp: (id, callback) => {
        const query = `
        UPDATE users 
        SET isEmailVerified = 1, emailOtp = NULL, isVerified = 1
        WHERE id = ?`;
        connection.query(query, [id], callback);
    },

    verifyPhoneOtp: (id, callback) => {
        const query = `
        UPDATE users 
        SET isPhoneVerified = 1, phoneOtp = NULL,
            isVerified = 1
        WHERE id = ?`;
        connection.query(query, [id], callback);
    },

    findByEmail: (email, callback) => {
        const query = 'SELECT * FROM users WHERE email = ?';
        connection.query(query, [email], callback);
    },

    findByPhone: (phone, callback) => {
        const query = 'SELECT * FROM users WHERE phone = ?';
        connection.query(query, [phone], callback);
    },
    viewData: (id, callback) => {
        const query = 'SELECT id, name, email, phone, company, role, address, password FROM users WHERE id = ?';
        connection.query(query, [id], callback);
    },
    updateData: (id, userData, callback) => {
        const { name, email, phone, company, role, address } = userData;
        const query = 'UPDATE users SET name = ?, email = ?, phone = ?, company = ?, role = ?, address = ? WHERE id = ?';
        connection.query(query, [name, email, phone, company, role, address, id], callback);
    },
    updatePassword: (id, hashedPassword, callback) => {
        const query = 'UPDATE users SET password = ? WHERE id = ?';
        connection.query(query, [hashedPassword, id], callback);
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
