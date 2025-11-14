const connection = require('../config/db');
const { getTotalDomains } = require('../controllers/admin.controllers');

const Admin = {
    findByUsername: (username, callback) => {
        const query = 'SELECT * FROM admins WHERE username = ?';
        connection.query(query, [username], callback);
    },
    create: (adminData, callback) => {
        const { username, password } = adminData;
        const query = 'INSERT INTO admins (username, password, access) VALUES (?, ?, "owner")';
        connection.query(query, [username, password], callback);
    },
    getAllUsers: (callback) => {
        const query = 'SELECT id, name, email, phone, company, role, address FROM users';
        connection.query(query, callback);
    },
    deleteUserById: (id, callback) => {
        const query = 'DELETE FROM users WHERE id = ?';
        connection.query(query, [id], callback);
    },
    getUserById: (id, callback) => {
        const query = 'SELECT id, name, email, phone, company, role, address FROM users WHERE id = ?';
        connection.query(query, [id], callback);
    },
    getTotalUsers: (callback) => {
        const query = 'SELECT COUNT(*) as total FROM users';
        connection.query(query, callback);
    },
    getTotalServers: (callback) => {
        const query = 'SELECT COUNT(*) as total FROM servers';
        connection.query(query, callback);
    },

    getAllDomains: (callback) => {
        try {
            const query = 'SELECT * FROM domain_transactions ORDER BY registration_date DESC';
            connection.query(query, (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return callback(err, null);
                }
                callback(null, results);
            });
        } catch (error) {
            console.error('Error fetching domains:', error);
            callback(error, null);
        }
    },
    getTotalBillingLogs: (callback) => {
        const query = 'SELECT COUNT(*) as total FROM billing_logs';
        connection.query(query, callback);
    },
    getTotalInvoices: (callback) => {
        const query = 'SELECT COUNT(*) as total FROM invoices';
        connection.query(query, callback);
    },
    getTotalRevenue: (callback) => {
        const query = 'SELECT SUM(amount) as total FROM billing_logs';
        connection.query(query, callback);
    },
    getAllUsersWithDetails: (callback) => {
        const query = `SELECT u.*, 
            w.balance,
            (SELECT COUNT(*) FROM servers WHERE user_id = u.id) as server_count,
            (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.id) as total_logins,
            (SELECT COUNT(DISTINCT ip_address) FROM user_sessions WHERE user_id = u.id) as unique_ips,
            (SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE user_id = u.id) as total_spent,
            (SELECT COUNT(*) FROM billing_logs WHERE user_id = u.id) as transaction_count
            FROM users u 
            LEFT JOIN wallets w ON u.id = w.user_id 
            ORDER BY u.createdAt DESC`;
        connection.query(query, (err, results) => {
            if (err) {
                // If user_sessions table doesn't exist, return users without session data
                const fallbackQuery = `SELECT u.*, 
                    w.balance,
                    (SELECT COUNT(*) FROM servers WHERE user_id = u.id) as server_count,
                    0 as total_logins,
                    0 as unique_ips,
                    (SELECT COALESCE(SUM(amount), 0) FROM billing_logs WHERE user_id = u.id) as total_spent,
                    (SELECT COUNT(*) FROM billing_logs WHERE user_id = u.id) as transaction_count
                    FROM users u 
                    LEFT JOIN wallets w ON u.id = w.user_id 
                    ORDER BY u.createdAt DESC`;
                connection.query(fallbackQuery, callback);
            } else {
                callback(err, results);
            }
        });
    },
    getUserTransactions: (userId, callback) => {
        const query = `SELECT 
            wt.*,
            w.user_id,
            u.name as user_name,
            u.email
            FROM wallet_transactions wt
            JOIN wallets w ON wt.wallet_id = w.id
            JOIN users u ON w.user_id = u.id
            WHERE w.user_id = ?
            ORDER BY wt.created_at DESC`;
        connection.query(query, [userId], callback);
    },
    getAllTransactions: (callback) => {
        const query = `SELECT 
            wt.*,
            w.user_id,
            u.name as user_name,
            u.email,
            u.company
            FROM wallet_transactions wt
            JOIN wallets w ON wt.wallet_id = w.id
            JOIN users u ON w.user_id = u.id
            ORDER BY wt.created_at DESC
            LIMIT 1000`;
        connection.query(query, callback);
    },
    getBillingLogs: (callback) => {
        const query = `SELECT 
            bl.*,
            u.name as user_name,
            u.email,
            s.name as server_name
            FROM billing_logs bl
            JOIN users u ON bl.user_id = u.id
            LEFT JOIN servers s ON bl.server_id = s.id
            ORDER BY bl.created_at DESC
            LIMIT 1000`;
        connection.query(query, callback);
    },
    getUserBillingLogs: (userId, callback) => {
        const query = `SELECT 
            bl.*,
            u.name as user_name,
            u.email,
            s.name as server_name
            FROM billing_logs bl
            JOIN users u ON bl.user_id = u.id
            LEFT JOIN servers s ON bl.server_id = s.id
            WHERE bl.user_id = ?
            ORDER BY bl.created_at DESC`;
        connection.query(query, [userId], callback);
    },
    getActiveSessions: (callback) => {
        const query = `SELECT 
            us.*,
            u.name,
            u.email,
            u.company
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.is_active = true
            ORDER BY us.login_time DESC`;
        connection.query(query, (err, results) => {
            if (err) {
                // If user_sessions table doesn't exist, return empty array
                callback(null, []);
            } else {
                callback(err, results);
            }
        });
    },
    getUniqueIPs: (callback) => {
        const query = `SELECT 
            ip_address,
            location,
            COUNT(DISTINCT user_id) as user_count,
            COUNT(*) as total_logins,
            MAX(login_time) as last_login
            FROM user_sessions 
            GROUP BY ip_address, location
            ORDER BY last_login DESC`;
        connection.query(query, (err, results) => {
            if (err) {
                // If user_sessions table doesn't exist, return empty array
                callback(null, []);
            } else {
                callback(err, results);
            }
        });
    },
    getDashboardStats: (callback) => {
        const query = `SELECT 
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM servers WHERE status = 'active') as active_servers,
            (SELECT COUNT(*) FROM servers) as total_servers,
            (SELECT COUNT(*) FROM billing_logs) as total_transactions,
            (SELECT COALESCE(SUM(amount), 0) FROM billing_logs) as total_revenue,
            (SELECT COUNT(*) FROM invoices) as total_invoices,
            (SELECT COUNT(*) FROM user_sessions WHERE is_active = true) as active_sessions,
            (SELECT COUNT(DISTINCT ip_address) FROM user_sessions) as unique_ips`;
        connection.query(query, (err, results) => {
            if (err) {
                // If user_sessions table doesn't exist, return stats without session data
                const fallbackQuery = `SELECT 
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM servers WHERE status = 'active') as active_servers,
                    (SELECT COUNT(*) FROM servers) as total_servers,
                    (SELECT COUNT(*) FROM billing_logs) as total_transactions,
                    (SELECT COALESCE(SUM(amount), 0) FROM billing_logs) as total_revenue,
                    (SELECT COUNT(*) FROM invoices) as total_invoices,
                    0 as active_sessions,
                    0 as unique_ips`;
                connection.query(fallbackQuery, callback);
            } else {
                callback(err, results);
            }
        });
    },
    getUserServers: (userId, callback) => {
        const query = `SELECT 
            s.*,
            u.name as user_name,
            u.email
            FROM servers s
            JOIN users u ON s.user_id = u.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC`;
        connection.query(query, [userId], callback);
    },
    getAllServers: (callback) => {
        const query = `SELECT 
            s.*,
            u.name as user_name,
            u.email,
            u.company
            FROM servers s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.created_at DESC`;
        connection.query(query, callback);
    },
    getRecentActivity: (callback) => {
        const query = `(
            SELECT 'login' as activity_type, 
                   us.login_time as activity_time, 
                   u.name as user_name, 
                   u.email,
                   us.ip_address,
                   'User logged in' as description
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.login_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY us.login_time DESC
            LIMIT 50
        )
        UNION ALL
        (
            SELECT 'transaction' as activity_type,
                   wt.created_at as activity_time,
                   u.name as user_name,
                   u.email,
                   NULL as ip_address,
                   CONCAT('Transaction: ', wt.description) as description
            FROM wallet_transactions wt
            JOIN wallets w ON wt.wallet_id = w.id
            JOIN users u ON w.user_id = u.id
            WHERE wt.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY wt.created_at DESC
            LIMIT 50
        )
        ORDER BY activity_time DESC
        LIMIT 100`;
        connection.query(query, (err, results) => {
            if (err) {
                // If user_sessions table doesn't exist, return only transaction activities
                const fallbackQuery = `SELECT 'transaction' as activity_type,
                   wt.created_at as activity_time,
                   u.name as user_name,
                   u.email,
                   NULL as ip_address,
                   CONCAT('Transaction: ', wt.description) as description
            FROM wallet_transactions wt
            JOIN wallets w ON wt.wallet_id = w.id
            JOIN users u ON w.user_id = u.id
            WHERE wt.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY wt.created_at DESC
            LIMIT 100`;
                connection.query(fallbackQuery, callback);
            } else {
                callback(err, results);
            }
        });
    }
}

module.exports = Admin;