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
- Wallet balance management
- Razorpay integration for payments
- Promo code system with usage tracking
- Transaction history and billing logs
- Multi-currency wallet support (INR/USD)

### 3. **Server/Cloud Deployment**
- VPS deployment plans (SFC-4GB, SFC-8GB, SFC-16GB, SFC-32GB)
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
- **Razorpay** (v2.9.6) - Payment gateway
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

### Billing Flow
1. **Hourly Billing** (cron job every hour)
   - Processes active servers
   - Deducts from wallet
   - Creates billing log entries
   - Updates billing summary

2. **Monthly Invoicing** (cron job on 5th of each month)
   - Generates PDF invoices
   - Includes GST calculation
   - Server breakdown per invoice
   - Stores invoice metadata

### Payment Methods
- **Razorpay** - For INR payments
- **Wallet** - Internal wallet system
- **Webhook support** - For payment verification

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
- `GET /` - Get wallet balance
- `POST /create-order` - Create Razorpay order
- `POST /verify` - Verify payment
- `POST /apply-promo` - Apply promo code
- `GET /transactions` - Get transactions
- `POST /webhooks/razorpay` - Payment webhook

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
- `MYSQL_DB_HOST`, `MYSQL_DB_USER`, `MYSQL_DB_PASSWORD`, `MYSQL_DB_NAME`, `MYSQL_DB_PORT`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
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

