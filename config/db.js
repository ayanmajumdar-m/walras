const { createConnection } = require('./pgCompat');
const { resolveDbConfig } = require('./dbConfig');
require('dotenv').config();

/**
 * PostgreSQL, behind a mysql2-shaped facade (see pgCompat.js).
 *
 * Configuration comes from a single DATABASE_URL where one is set, falling
 * back to the discrete PG_DB_* / MYSQL_DB_* variables. See dbConfig.js.
 */
const dbConfig = resolveDbConfig();
const connection = createConnection(dbConfig);

// Authentication happens in BUTTR ID, so this table holds no password and no
// verification codes. buttr_sub is the account key: the pairwise subject
// identifier BUTTR ID issues for this client. email and phone are a local copy
// of what BUTTR ID shared, kept for billing and for reaching the customer —
// neither is the identity, and an account created with only a mobile number
// arrives with no email at all.
//
// This shape only applies to a database that has never held a pre-BUTTR user.
const createTableUsers = `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
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
    lastLoginAt TIMESTAMPTZ,
    lastLoginIP VARCHAR(45),
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`;

// There is no migration from the pre-BUTTR schema. Every account is created by
// a BUTTR ID sign-in, so a database carrying old password-authenticated rows is
// wiped rather than upgraded — run `node reset-accounts.js` once, deliberately.

const createAdminsTable = `CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    access VARCHAR(17) CHECK (access IN ('owner', 'billing')) DEFAULT 'billing',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`;

const createWalletTable = `
    CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  balance BIGINT DEFAULT 0, -- stored in paise (₹1 = 100)
  currency VARCHAR(10) DEFAULT 'INR',
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createWalletTransactionTable = `
    CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INT NOT NULL,
  type VARCHAR(16) CHECK (type IN ('credit','debit')) NOT NULL,
  amount BIGINT NOT NULL, -- paise
  description VARCHAR(255),
  status VARCHAR(19) CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'completed',
  reference_id VARCHAR(255), -- server deployment id or other reference
  razorpay_payment_id VARCHAR(255) NULL, -- Razorpay payment ID for wallet top-ups
  razorpay_order_id VARCHAR(255) NULL, -- Razorpay order ID
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
)
`;

const createBillingLogsTable = `
    CREATE TABLE IF NOT EXISTS billing_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    server_id INT,
    amount BIGINT NOT NULL, -- in paise
    billing_period TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createInvoicesTable = `
    CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    file_path VARCHAR(500),
    amount BIGINT NOT NULL, -- in paise
    period VARCHAR(7), -- YYYY-MM format
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createServerTable = `
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
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
    status VARCHAR(19) CHECK (status IN ('deploying', 'active', 'stopped', 'paused', 'failed')) DEFAULT 'deploying',
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createPromoCodesTable = `
CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    credit_amount BIGINT NOT NULL, -- in paise
    usage_limit INT DEFAULT NULL, -- NULL means unlimited
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_by INT, -- admin id
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
)
`;

const createPromoUsageTable = `
CREATE TABLE IF NOT EXISTS promo_code_usage (
    id SERIAL PRIMARY KEY,
    promo_code_id INT NOT NULL,
    user_id INT NOT NULL,
    used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createMonthlyInvoicesTable = `
CREATE TABLE IF NOT EXISTS monthly_invoices (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    billing_month DATE NOT NULL,
    total_amount BIGINT NOT NULL, -- in paise
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(17) CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ NULL,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createUserSessionsTable = `
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    login_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMPTZ NULL,
    is_active BOOLEAN DEFAULT TRUE,
    location VARCHAR(255),
    session_token VARCHAR(255) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;


const createTransactionsTable = `
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(16) CHECK (type IN ('credit', 'debit')) NOT NULL,
    amount BIGINT NOT NULL, -- in paise
    description TEXT,
    reference_id VARCHAR(255), -- razorpay payment_id, wallet_transaction_id, etc.
    reference_type VARCHAR(17) CHECK (reference_type IN ('payment', 'wallet', 'billing', 'refund')) DEFAULT 'payment',
    status VARCHAR(19) CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createDomainTransactionsTable = `
CREATE TABLE IF NOT EXISTS domain_transactions (
    id SERIAL PRIMARY KEY,
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
    status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'registered', 'failed', 'expired')) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    registration_date TIMESTAMPTZ,
    expiration_date TIMESTAMPTZ,
    auth_code VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;
// A database that is unreachable at boot used to throw out of this callback and
// take the process down, so a wrong MYSQL_DB_HOST looked like a crash-loop. The
// server now starts either way and says so; requests that need the database
// fail individually instead.
// MySQL's ON UPDATE CURRENT_TIMESTAMP has no column-level equivalent, so the
// tables that relied on it get a shared trigger instead.
const createTouchFunction = `
CREATE OR REPLACE FUNCTION buttr_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
`;

const touchTriggers = ['admins', 'wallets', 'transactions', 'domain_transactions'].map(
    (table) => `
CREATE OR REPLACE TRIGGER ${table}_touch_updated_at
BEFORE UPDATE ON ${table}
FOR EACH ROW EXECUTE FUNCTION buttr_touch_updated_at()`
);

/*
  users spells the column updatedAt in the DDL, but it was declared unquoted,
  and PostgreSQL folds unquoted identifiers to lowercase — so the column is
  really `updatedat`. Writing NEW."updatedAt" here looks right and fails at
  runtime with `record "new" has no field "updatedAt"`.
*/
const createUsersTouch = `
CREATE OR REPLACE FUNCTION buttr_touch_updatedat() RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
`;

const createUsersTouchTrigger = `
CREATE OR REPLACE TRIGGER users_touch_updatedat
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION buttr_touch_updatedat()`;

// Indexes that were declared inline in the MySQL CREATE TABLE bodies.
const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_dt_user_id ON domain_transactions (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dt_status ON domain_transactions (status)',
    'CREATE INDEX IF NOT EXISTS idx_dt_full_domain ON domain_transactions (full_domain)',
    'CREATE INDEX IF NOT EXISTS idx_dt_created_at ON domain_transactions (created_at)',
];

connection.on('error', (err) => {
    console.error('PostgreSQL connection error:', err.code || err.message);
});

connection.connect((err) => {
    if (err) {
        console.error('❌ PostgreSQL connection failed:', err.message);
        console.error('   The server will start, but nothing that touches the database will work.');
        return;
    }

    console.log(`Connected to PostgreSQL (${dbConfig._describe}) via ${dbConfig._source}`);

    /*
      Run the schema in order, one statement at a time.

      The MySQL version fired all of these at once and got away with it because
      a single mysql2 connection serialises everything. A pool does not: the
      statements land on different clients concurrently, and a child table can
      reach the server before the parent it references exists. Every run then
      fails differently, which is exactly the kind of bug that looks flaky.
    */
    const schema = [
        ['Users', createTableUsers],
        ['Admins', createAdminsTable],
        ['Wallet', createWalletTable],
        ['Wallet transaction', createWalletTransactionTable],
        ['Billing logs', createBillingLogsTable],
        ['Invoices', createInvoicesTable],
        ['Server', createServerTable],
        ['User sessions', createUserSessionsTable],
        ['Transactions', createTransactionsTable],
        ['Promo codes', createPromoCodesTable],
        ['Promo usage', createPromoUsageTable],
        ['Monthly invoices', createMonthlyInvoicesTable],
        ['Domain transactions', createDomainTransactionsTable],
        ['updated_at function', createTouchFunction],
        ...touchTriggers.map((sql, i) => [`updated_at trigger ${i + 1}`, sql]),
        ['updatedAt function', createUsersTouch],
        ['updatedAt trigger', createUsersTouchTrigger],
        ...createIndexes.map((sql, i) => [`index ${i + 1}`, sql]),
    ];

    const step = (i) => {
        if (i >= schema.length) {
            console.log(`✅ Schema ready (${schema.length} statements)`);
            return;
        }
        const [label, sql] = schema[i];
        connection.query(sql, (stepErr) => {
            if (stepErr) console.error(`${label} setup failed:`, stepErr.message);
            step(i + 1);
        });
    };
    step(0);
});

module.exports = connection;
