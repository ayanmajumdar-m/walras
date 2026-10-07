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

// Walras Cloud runs its own sign-up and sign-in: email + password, with the
// email address confirmed by a one-time code sent through Brevo. Codes live in
// email_codes (hashed), never on the users row.
//
// Emails are stored lowercased by the application, so UNIQUE is effectively
// case-insensitive.
const createTableUsers = `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account_type VARCHAR(10) NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'business')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    company VARCHAR(100),
    gstin VARCHAR(15),
    role VARCHAR(50),
    address VARCHAR(255),
    isVerified BOOLEAN DEFAULT FALSE,
    isEmailVerified BOOLEAN DEFAULT FALSE,
    isPhoneVerified BOOLEAN DEFAULT FALSE,
    lastLoginAt TIMESTAMPTZ,
    lastLoginIP VARCHAR(45),
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`;

/*
  Upgrades a users table created during the earlier single-sign-on period. Additive only:
  nothing is dropped, so existing accounts keep their id, wallet and servers.
  Those accounts have no password yet; their owners set one with "Forgot
  password", which also proves they still hold the email address.
*/
const migrateLegacyUsers = [
    `DO $$
     BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'users' AND column_name = 'buttr_sub') THEN
         ALTER TABLE users ALTER COLUMN buttr_sub DROP NOT NULL;
       END IF;
     END $$`,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'business'))",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS gstin VARCHAR(15)',
    // The customer's Zendesk end-user (support tickets), linked on first use.
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS zendesk_user_id BIGINT',
];

// Small key/value store for settings admins can change without a redeploy
// (e.g. the email sender name and address).
const createAppSettingsTable = `
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
`;

// ── Admin console: roles, permissions, audit trail, customer suspension ──
// Additive upgrades of the admins and users tables.
const migrateAdmins = [
    "ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(20)",
    'ALTER TABLE admins ADD COLUMN IF NOT EXISTS full_name VARCHAR(100)',
    'ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE',
    'ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ',
    'ALTER TABLE admins ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ',
    // The old two-level access maps onto the new roles once.
    "UPDATE admins SET role = CASE WHEN access = 'owner' THEN 'super_admin' ELSE 'finance' END WHERE role IS NULL",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(255)',
];

// Which permissions each role has. super_admin always has every permission
// regardless of this table (see utils/adminRbac.js).
const createRolePermissionsTable = `
CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    permission VARCHAR(40) NOT NULL,
    UNIQUE (role, permission)
)
`;

// Who did what, to which record, from where. Never updated or deleted by the app.
const createAuditLogsTable = `
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INT,
    admin_username VARCHAR(50),
    action VARCHAR(60) NOT NULL,
    target_type VARCHAR(30),
    target_id VARCHAR(60),
    metadata JSONB,
    ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
`;

// One-time codes for email verification and password reset. Only an HMAC of
// the code is stored; attempts caps guessing on a single code.
const createEmailCodesTable = `
CREATE TABLE IF NOT EXISTS email_codes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    purpose VARCHAR(10) NOT NULL CHECK (purpose IN ('verify', 'reset')),
    code_hash VARCHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

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

// Cloud Compute on SolusVM: each server row remembers its SolusVM server and
// location so it can be managed, and so deleting it returns the stock.
const migrateServers = [
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS solus_server_id BIGINT',
    'ALTER TABLE servers ADD COLUMN IF NOT EXISTS location_id INT',
];

// Team members: people an account owner has invited (by email) and the
// access they have in the owner's account. See utils/team.js.
const createTeamMembersTable = `
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    member_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    permissions VARCHAR(100) NOT NULL DEFAULT '',
    status VARCHAR(10) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    UNIQUE (owner_id, email)
)`;

// Bulk email campaigns sent from the admin panel (services/bulkEmail.js).
// last_user_id lets an interrupted campaign resume without repeats.
const createBulkEmailsTable = `
CREATE TABLE IF NOT EXISTS bulk_emails (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('announcement', 'marketing')),
    audience VARCHAR(20) NOT NULL,
    status VARCHAR(15) NOT NULL CHECK (status IN ('sending', 'sent', 'interrupted', 'cancelled')),
    total INT NOT NULL DEFAULT 0,
    sent INT NOT NULL DEFAULT 0,
    failed INT NOT NULL DEFAULT 0,
    last_user_id INT NOT NULL DEFAULT 0,
    last_error VARCHAR(300),
    created_by INT,
    created_by_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ
)`;

// Quantity of each Cloud Compute plan an admin allows to be sold, per SolusVM
// location. Deploying takes one; deleting a server gives it back.
const createComputeStockTable = `
CREATE TABLE IF NOT EXISTS compute_stock (
    plan VARCHAR(40) NOT NULL,
    location_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan, location_id)
)`;

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

const createHostingAccountsTable = `
CREATE TABLE IF NOT EXISTS hosting_accounts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    cpanel_package VARCHAR(100) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    cpanel_username VARCHAR(16) NOT NULL,
    cpanel_password VARCHAR(255) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'suspended', 'terminated', 'pending')) DEFAULT 'active',
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    amount BIGINT NOT NULL, -- in paise
    currency VARCHAR(10) DEFAULT 'INR',
    expires_at TIMESTAMPTZ NOT NULL,
    suspended_at TIMESTAMPTZ NULL,
    suspension_reason VARCHAR(255) NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
`;

const createHostingOrdersTable = `
CREATE TABLE IF NOT EXISTS hosting_orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    billing_cycle VARCHAR(50) DEFAULT '1 Month',
    base_amount BIGINT NOT NULL, -- in paise (e.g. 15900, 25900)
    gst_amount BIGINT NOT NULL,  -- in paise (18% GST: 2862, 4662)
    total_amount BIGINT NOT NULL, -- in paise (e.g. 18762, 30562)
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    tracking_id VARCHAR(100),
    bank_ref_no VARCHAR(100),
    failure_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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

const touchTriggers = ['admins', 'wallets', 'transactions', 'domain_transactions', 'hosting_accounts', 'hosting_orders'].map(
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
    'CREATE INDEX IF NOT EXISTS idx_ha_user_id ON hosting_accounts (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ha_status ON hosting_accounts (status)',
    'CREATE INDEX IF NOT EXISTS idx_ha_expires_at ON hosting_accounts (expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_ho_user_id ON hosting_orders (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ho_order_id ON hosting_orders (order_id)',
    'CREATE INDEX IF NOT EXISTS idx_ho_status ON hosting_orders (status)',
    'CREATE INDEX IF NOT EXISTS idx_email_codes_user ON email_codes (user_id, purpose)',
    'CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs (created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs (action)',
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
        ...migrateLegacyUsers.map((sql, i) => [`users migration ${i + 1}`, sql]),
        ['Email codes', createEmailCodesTable],
        ['App settings', createAppSettingsTable],
        ['Admins', createAdminsTable],
        ...migrateAdmins.map((sql, i) => [`admin migration ${i + 1}`, sql]),
        ['Role permissions', createRolePermissionsTable],
        ['Audit logs', createAuditLogsTable],
        ['Wallet', createWalletTable],
        ['Wallet transaction', createWalletTransactionTable],
        ['Billing logs', createBillingLogsTable],
        ['Invoices', createInvoicesTable],
        ['Server', createServerTable],
        ...migrateServers.map((sql, i) => [`servers migration ${i + 1}`, sql]),
        ['Compute stock', createComputeStockTable],
        ['Team members', createTeamMembersTable],
        // Team access became a role (write / admin); older access lists become write.
        ['team roles', "UPDATE team_members SET permissions = 'write' WHERE permissions NOT IN ('write', 'admin')"],
        ['Bulk emails', createBulkEmailsTable],
        ['users marketing opt-out', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE'],
        ['team members index', 'CREATE INDEX IF NOT EXISTS team_members_member_idx ON team_members (member_user_id)'],
        ['team invites index', 'CREATE INDEX IF NOT EXISTS team_members_email_idx ON team_members (LOWER(email))'],
        ['User sessions', createUserSessionsTable],
        ['Transactions', createTransactionsTable],
        ['Promo codes', createPromoCodesTable],
        ['Promo usage', createPromoUsageTable],
        ['Monthly invoices', createMonthlyInvoicesTable],
        ['Domain transactions', createDomainTransactionsTable],
        ['Hosting accounts', createHostingAccountsTable],
        ['Hosting orders', createHostingOrdersTable],
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
