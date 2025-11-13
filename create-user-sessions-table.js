const connection = require('./config/db');

const createUserSessionsTable = `
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    logout_time DATETIME NULL,
    is_active BOOLEAN DEFAULT TRUE,
    location VARCHAR(255),
    session_token VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`;

console.log('Creating user_sessions table...');

connection.query(createUserSessionsTable, (err, result) => {
    if (err) {
        console.error('Error creating user_sessions table:', err);
    } else {
        console.log('✅ user_sessions table created successfully!');
    }
    
    connection.end();
});
