# Codebase Overview - Walras Cloud AuthSystem

## 🏗️ Architecture Overview

This is a **full-stack cloud hosting and domain management platform** built with:
- **Backend**: Node.js/Express with PostgreSQL database
- **Frontend**: React.js with React Router
- **Deployment**: Docker containerization with multi-stage build

---

## 📁 Project Structure

### Backend (`/`)
```
├── config/           # Database and service configurations
├── controllers/      # Business logic handlers
├── model/           # Database models/queries
├── routes/          # API route definitions
├── services/        # Service layer (billing, payments, domain)
├── utils/           # Utilities (auth, validation, email)
├── scripts/         # Migration and utility scripts
├── tests/           # Test files
└── index.js         # Server entry point
```

### Frontend (`/client`)
```
├── src/
│   ├── components/
│   │   ├── About/              # About, Pricing, Contact pages
│   │   ├── AdminDashboard/     # Admin panel components
│   │   ├── AuthScreen/         # BUTTR ID sign-in handoff + callback
│   │   ├── Constants/          # Navbar, Footer
│   │   ├── ProtectedRoutes/    # User dashboard and protected pages
│   │   │   └── DashboardContent/ # Deploy, Domains, Invoices, etc.
│   │   └── [various pages]     # Homepage, DomainCheck, Cart, etc.
│   ├── contexts/               # React Context (Currency)
│   ├── utils/                  # Frontend utilities
│   └── config.js               # API configuration
```

---

## 🎯 Core Features

### 1. **User Authentication & Management**
- Sign-in delegated to **BUTTR ID** (OpenID Connect, authorization code + PKCE)
- No local passwords, OTPs or password-reset flow
- Accounts keyed on the pairwise `sub` BUTTR ID issues for this client
- Short-lived JWT session token minted after a verified BUTTR ID sign-in
- Session management with IP tracking
- Multi-currency support (USD/INR)

See **BUTTR_ID_INTEGRATION.md** for the flow, configuration and migration notes.

### 2. **Wallet & Payment System**
- Account balance (wallet), topped up through **CCAvenue** (UPI, cards, net banking), the only payment gateway
- Credits are applied exactly once per order (`utils/walletCredit.js`), however many times CCAvenue calls back
- Promo codes: one use per customer, usage limits enforced in the database
- Wallet transactions, monthly invoices (PDF) and an invoice payment flow
- Auto top-up via CCAvenue Standing Instructions (built, switched off until CCAvenue's SI details are confirmed)

### 3. **Server/Cloud Deployment**
- VPS deployment plans (WSC-4GB, SFC-8GB, SFC-16GB, SFC-32GB)
- Hourly billing system with automated cron jobs
- Server status management
- Configuration tracking

### 4. **Domain Management**
- Domain search and availability checking (WHOIS API)
- Domain purchase via OpenProvider API
- Domain transfer functionality
- Nameserver management
- Domain contact management
- Transaction tracking

### 5. **Billing & Invoicing**
- **Hourly billing** via cron jobs for active servers
- **Monthly invoice generation** (automated on 5th of each month)
- GST calculation (18% for Indian users)
- PDF invoice generation
- Separate billing logs for USD and INR users
- Currency-specific billing tables (`billing_logs_usd`, `billing_logs_inr`)

### 6. **Admin Dashboard**
- User management (view, delete, verify users)
- Server monitoring
- Transaction logs and revenue tracking
- Wallet balance management
- Promo code management
- Invoice management
- Session monitoring and IP tracking
- Activity logs
- Currency-separated analytics

### 7. **Support & Ticketing**
- Integrated with BoldDesk for ticket management
- Ticket creation and retrieval

---

## 🔧 Technology Stack

### Backend Dependencies
- **Express.js** (v5.1.0) - Web framework
- **PostgreSQL** (pg v8) - Database, behind a mysql2-shaped facade (`config/pgCompat.js`)
- **JWT** (jsonwebtoken v9.0.2) - Session tokens
- **BUTTR ID** - OpenID Connect identity provider (user authentication)
- **bcrypt** (v6.0.0) - Admin password hashing
- **CCAvenue** - Payment gateway (AES-128 encrypted form post and callbacks; no SDK)
- **node-cron** (v4.2.1) - Scheduled tasks
- **PDFKit** (v0.17.2) - Invoice generation
- **Axios** - HTTP client
- **Brevo** (@getbrevo/brevo) - Email service

### Frontend Dependencies
- **React** (v18.3.1) - UI library
- **React Router DOM** (v7.9.2) - Routing
- **Lucide React** - Icons

---

## 🗄️ Database Schema

### Core Tables
1. **users** - User accounts with currency preference
2. **admins** - Admin accounts with access levels (owner/billing)
3. **wallets** - User wallet balances
4. **wallet_transactions** - Wallet transaction history
5. **servers** - Deployed server instances
6. **billing_logs** - Unified billing logs (legacy)
7. **billing_logs_usd** - USD billing logs
8. **billing_logs_inr** - INR billing logs
9. **transactions** - Unified transaction log
10. **monthly_invoices** - Monthly invoice records
11. **promo_codes** - Promotional codes
12. **promo_code_usage** - Promo code usage tracking
13. **domain_transactions** - Domain purchase records
14. **domain_contacts** - Domain contact information
15. **user_sessions** - User login sessions with IP tracking
16. **user_billing_summary** - Aggregated billing statistics

---

## 🔐 Security Features

1. **Authentication**
   - User identity proved by BUTTR ID; ID tokens verified against its JWKS
     (RS256 signature, issuer, audience, expiry, nonce)
   - PKCE (S256) and `state` on every authorization request
   - JWT session tokens with configurable expiration
   - Admin passwords hashed with bcrypt (10 salt rounds)
   - Session token management

2. **Authorization**
   - Role-based access (Owner/Billing admin)
   - Protected routes with middleware
   - Token validation on all protected endpoints

3. **Validation**
   - Email and phone validation
   - Password rules and CAPTCHA are BUTTR ID's responsibility
   - Input sanitization

4. **Security Headers**
   - CORS configuration
   - Secure cookie handling

---

## 💰 Billing System Architecture

### Currency Handling
- **Storage Units**: All amounts stored in minor units (paise for INR, cents for USD)
- **Multi-currency support**: Separate tables for USD and INR billing logs
- **Conversion rate**: 1 USD = 83 INR (configurable)

### Billing Flow (prepaid, `utils/monthlyBilling.js`)
1. **Purchase**: a Virtual Machine is paid from the account balance at checkout:
   - Monthly: the rest of the current month, pro rata per day (India time, purchase day included), plus GST.
   - Reserved (3–36 months): the whole term up front with its savings, from the purchase day.
   Each purchase is recorded as a paid invoice.
2. **Renewal** (cron on the 1st at 00:00 IST, plus a run every 15 minutes):
   - Monthly servers are invoiced for the month ahead; reservations renew for the same term when it ends.
   - The account balance pays first; the rest is paid through CCAvenue (Billing → Invoices).
3. **Unpaid invoices**: due the day they're issued; on the 3rd a 10% late fee on the unpaid amount
   (admins can waive it) and the account's servers are suspended (stopped on SolusVM, force-stopped if
   they ignore the shutdown); final notice on the 6th; servers deleted on the 7th. Paying restarts them.
4. **Cancelling** takes effect at the end of what's paid (month or reservation); no refunds.

### Payment Methods
- **CCAvenue** - The only gateway: account balance top-ups and invoice payments
- **Account balance** - Pays purchases, renewals and domains

---

## 🌐 API Endpoints

### User Routes (`/api/users`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /verify-email-otp` - Email verification
- `POST /verify-phone-otp` - Phone verification
- `GET /profile/:id` - Get user profile
- `PUT /profile/:id` - Update profile
- `GET /invoices` - Get user invoices
- `GET /domain-check` - Check domain availability
- `POST /openprovider/purchase-domain` - Purchase domain
- `GET /domains/purchased` - Get purchased domains

### Wallet Routes (`/api/wallet`)
- `GET /` - Balance, next renewal amount and date
- `GET /transactions` - Wallet transactions
- `POST /apply-promo` - Apply promo code
- `GET|PUT|DELETE /auto-topup`, `POST /auto-topup/setup` - Auto top-up

### Payment Routes (`/api/payment`)
- `POST /ccavenue/initiate-wallet` - Start a CCAvenue top-up
- `POST /ccavenue/response` - CCAvenue callback (top-ups, invoice payments, auto top-up setup)
- `POST /ccavenue/cancel` - CCAvenue cancel callback

### Invoice Routes (`/api/invoices`)
- `GET /` - Invoices and amount due
- `GET /:id`, `GET /:id/pdf` - Invoice lines and PDF
- `POST /:id/pay` - Pay from the balance, the rest through CCAvenue

### Admin Routes (`/api/admin`)
- `POST /login` - Admin login
- `GET /dashboardStats` - Dashboard statistics
- `GET /viewAllUsers` - Get all users
- `GET /getAllTransactions` - Get all transactions
- `GET /promo-codes` - Get promo codes
- `POST /generate-monthly-invoices` - Generate invoices
- `GET /currency/statistics` - Currency statistics

### Server Routes (`/api/servers`)
- Server management endpoints

---

## 📅 Automated Tasks (Cron Jobs)

1. **Hourly Billing** (`0 * * * *`)
   - Charges users for active servers every hour

2. **Monthly Invoice Generation** (`0 0 5 * *`)
   - Generates invoices on 5th of each month for previous month

3. **Invoice Update Check** (`30 * * * *`)
   - Checks for invoice updates every hour at minute 30

---

## 🔄 Migration System

The codebase includes migration scripts for:
- **Billing logs currency separation**
  - Migrates from unified `billing_logs` to currency-specific tables
  - Supports rollback functionality
  - Located in `/scripts/`

---

## 🚀 Deployment

### Docker Setup
- Multi-stage build process
- Builds React frontend in first stage
- Combines with Node.js backend in final stage
- Serves static files from `/client/build`

### Environment Variables Required

**Backend:**
- `DATABASE_URL` (PostgreSQL)
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `SETTINGS_ENCRYPTION_KEY`
- `CCAVENUE_MERCHANT_ID`, `CCAVENUE_ACCESS_CODE`, `CCAVENUE_WORKING_KEY`, `CCAVENUE_ENVIRONMENT`
- `OPENPROVIDER_API`, `OPENPROVIDER_USERNAME`, `OPENPROVIDER_PASSWORD`
- `WHOIS_API_KEY`
- `FAST2SMS_API_KEY`
- Email service credentials (Brevo/SMTP)
- `CLIENT_URL`, `API_URL`

**Frontend:**
- `REACT_APP_PUBLIC_URL` - API base URL
- `REACT_APP_SITE_KEY` - reCAPTCHA site key

---

## 🧪 Testing

Test files located in `/tests/`:
- `currencyBillingService.test.js`
- `billingIntegration.test.js`

Run tests:
```bash
npm test                    # Run all tests
npm run test:currency       # Run currency tests
npm run test:integration    # Run integration tests
```

---

## 📊 Key Features Summary

✅ Multi-currency support (USD/INR)
✅ Automated hourly billing
✅ Monthly invoice generation with GST
✅ Domain registration and management
✅ VPS server deployment
✅ Wallet system with payment gateway
✅ Promo code system
✅ Admin dashboard with analytics
✅ Session management and IP tracking
✅ Email and phone OTP verification
✅ Support ticket integration

---

## 🔍 Code Quality Notes

### Strengths
- Well-organized MVC structure
- Comprehensive billing system with currency separation
- Automated invoice generation
- Multi-currency support throughout
- Security best practices (JWT, bcrypt, validation)

### Areas for Improvement
- Some callback-based code could use async/await
- Error handling could be more consistent
- Some duplicate code in controllers
- Database queries could benefit from query builders or ORM

---

## 📝 Notes

- The application uses a callback-based approach for database queries (consider migrating to async/await)
- Currency conversion rate is hardcoded in some places (83 INR = 1 USD)
- Both unified and currency-separated billing tables exist (migration in progress)
- Admin routes use role-based access control (Owner vs Billing)
- Frontend uses React Context for currency management
- Static files are served from the backend after React build

---

*Last Updated: Based on codebase review*
*Maintained by: Shlok*

