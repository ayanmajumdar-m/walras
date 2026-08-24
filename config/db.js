const mysql = require('mysql2');
require('dotenv').config();


const connection = mysql.createConnection({
    host: process.env.MYSQL_DB_HOST,
    user: process.env.MYSQL_DB_USER,
    password: process.env.MYSQL_DB_PASSWORD,
    database: process.env.MYSQL_DB_NAME,
    port: process.env.MYSQL_DB_PORT || 3306
});


// Authentication happens in BUTTR ID, so this table holds no password and no
// verification codes. buttr_sub is the account key: the pairwise subject
// identifier BUTTR ID issues for this client. email and phone are a local copy
// of what BUTTR ID shared, kept for billing and for reaching the customer —
// neither is the identity, and an account created with only a mobile number
// arrives with no email at all.
//
// This shape only applies to a database that has never held a pre-BUTTR user.
const createTableUsers = `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buttr_sub VARCHAR(255) NOT NULL UNIQUE,
    buttr_handle VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    company VARCHAR(100),
    role VARCHAR(50),
    address VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    isVerified BOOLEAN DEFAULT FALSE,
    isEmailVerified BOOLEAN DEFAULT FALSE,
    isPhoneVerified BOOLEAN DEFAULT FALSE,
    lastLoginAt DATETIME,
    lastLoginIP VARCHAR(45),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

// There is no migration from the pre-BUTTR schema. Every account is created by
// a BUTTR ID sign-in, so a database carrying old password-authenticated rows is
// wiped rather than upgraded — run `node reset-accounts.js` once, deliberately.

const createAdminsTable = `CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    access ENUM('owner', 'billing') DEFAULT 'billing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const createWalletTable = `
    CREATE TABLE IF NOT EXISTS wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  balance BIGINT DEFAULT 0, -- stored in paise (₹1 = 100)
  currency VARCHAR(10) DEFAULT 'INR',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createWalletTransactionTable = `
    CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_id INT NOT NULL,
  type ENUM('credit','debit') NOT NULL,
  amount BIGINT NOT NULL, -- paise
  description VARCHAR(255),
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
  reference_id VARCHAR(255), -- server deployment id or other reference
  razorpay_payment_id VARCHAR(255) NULL, -- Razorpay payment ID for wallet top-ups
  razorpay_order_id VARCHAR(255) NULL, -- Razorpay order ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
)
`;

const createBillingLogsTable = `
    CREATE TABLE IF NOT EXISTS billing_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    server_id INT,
    amount BIGINT NOT NULL, -- in paise
    billing_period DATETIME,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createInvoicesTable = `
    CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    file_path VARCHAR(500),
    amount BIGINT NOT NULL, -- in paise
    period VARCHAR(7), -- YYYY-MM format
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createServerTable = `
CREATE TABLE IF NOT EXISTS servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100),
    hostname VARCHAR(100),
    root_password VARCHAR(255),
    location VARCHAR(50),
    os VARCHAR(50),
    plan_id INT,
    plan_name VARCHAR(100),
    monthly_cost DECIMAL(10,2),
    hourly_cost DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'INR',
    ip_address VARCHAR(45),
    status ENUM('deploying', 'active', 'stopped', 'paused', 'failed') DEFAULT 'deploying',
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createPromoCodesTable = `
CREATE TABLE IF NOT EXISTS promo_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    credit_amount BIGINT NOT NULL, -- in paise
    usage_limit INT DEFAULT NULL, -- NULL means unlimited
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATETIME,
    created_by INT, -- admin id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
)
`;

const createPromoUsageTable = `
CREATE TABLE IF NOT EXISTS promo_code_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    promo_code_id INT NOT NULL,
    user_id INT NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createMonthlyInvoicesTable = `
CREATE TABLE IF NOT EXISTS monthly_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    billing_month DATE NOT NULL,
    total_amount BIGINT NOT NULL, -- in paise
    currency VARCHAR(10) DEFAULT 'INR',
    status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    paid_at DATETIME NULL,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

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
)
`;


const createTransactionsTable = `
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('credit', 'debit') NOT NULL,
    amount BIGINT NOT NULL, -- in paise
    description TEXT,
    reference_id VARCHAR(255), -- razorpay payment_id, wallet_transaction_id, etc.
    reference_type ENUM('payment', 'wallet', 'billing', 'refund') DEFAULT 'payment',
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createDomainTransactionsTable = `
CREATE TABLE IF NOT EXISTS domain_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    domain_name VARCHAR(255) NOT NULL,
    domain_extension VARCHAR(10) NOT NULL,
    full_domain VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    registration_period INT DEFAULT 1, -- in years
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    openprovider_domain_id VARCHAR(255),
    status ENUM('pending', 'processing', 'registered', 'failed', 'expired') DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    registration_date DATETIME,
    expiration_date DATETIME,
    auth_code VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_full_domain (full_domain),
    INDEX idx_created_at (created_at)
)
`;
connection.connect((err) => {
    if (err) {
        throw err;
    }
    else {
        console.log('Connected to MySQL Database');
        connection.query(createTableUsers, (err, result) => {
            if (err) throw err;
            console.log('Users table ensured');
        });
        connection.query(createAdminsTable, (err, result) => {
            if (err) throw err;
            console.log('Admins table ensured');
        });

        connection.query(createWalletTable, (err, result) => {
            if (err) throw err;
            console.log("Wallet table ensured")
        });

        connection.query(createWalletTransactionTable, (err, result) => {
            if (err) throw err;
            console.log("Wallet transaction table ensured")
        });

        connection.query(createBillingLogsTable, (err, result)=>{
            if (err) throw err;
            console.log("Billings transaction table ensured")
        });
        connection.query(createInvoicesTable, (err, result)=>{
            if (err) throw err;
            console.log("Invoices table ensured")
        });
        connection.query(createServerTable, (err, result)=>{
            if (err) throw err;
            console.log("Server table ensured")
        })
        connection.query(createUserSessionsTable, (err, result)=>{
            if (err) throw err;
            console.log("User sessions table ensured")
        })
        connection.query(createTransactionsTable, (err, result)=>{
            if (err) throw err;
            console.log("Transactions table ensured")
        })
        connection.query(createPromoCodesTable, (err, result)=>{
            if (err) throw err;
            console.log("Promo codes table ensured")
        })
        connection.query(createPromoUsageTable, (err, result)=>{
            if (err) throw err;
            console.log("Promo usage table ensured")
        })
        connection.query(createMonthlyInvoicesTable, (err, result)=>{
            if (err) throw err;
            console.log("Monthly invoices table ensured")
        })
        connection.query(createDomainTransactionsTable, (err, result)=>{
            if (err) throw err;
            console.log("Domain transactions table ensured")
        })
    }
})

module.exports = connection;
