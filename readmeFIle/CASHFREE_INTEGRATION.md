# Cashfree Payment Gateway Integration

> **Historical note (October 2026):** Razorpay, PayPal and Cashfree have been removed. Walras Cloud takes payments through **CCAvenue only** (account balance top-ups and invoice payments). This document describes earlier work and is kept for reference; see CODEBASE_OVERVIEW.md for how payments work now.

This document describes the Cashfree payment gateway integration for wallet top-ups.

## Overview

Cashfree has been integrated as an additional payment gateway option alongside Razorpay. Users can now choose between Razorpay and Cashfree when adding funds to their wallet.

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Cashfree Configuration (Sandbox)
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your_sandbox_app_id
CASHFREE_SECRET_KEY=your_sandbox_secret_key
CASHFREE_API_VERSION=2023-08-01

# For production
# CASHFREE_ENV=production
# CASHFREE_APP_ID=your_production_app_id
# CASHFREE_SECRET_KEY=your_production_secret_key
```

### 2. Database Migration

The `wallet_transactions` table has been updated to support Cashfree references. Run the migration:

```sql
-- Add Cashfree columns to wallet_transactions table
ALTER TABLE wallet_transactions 
ADD COLUMN cashfree_order_id VARCHAR(255) NULL AFTER razorpay_order_id;

ALTER TABLE wallet_transactions 
ADD COLUMN cashfree_payment_id VARCHAR(255) NULL AFTER cashfree_order_id;

-- Add indexes
ALTER TABLE wallet_transactions
ADD INDEX idx_cashfree_order_id (cashfree_order_id);

ALTER TABLE wallet_transactions
ADD INDEX idx_cashfree_payment_id (cashfree_payment_id);
```

Or run the migration file:
```bash
mysql -u your_user -p your_database < migrations/add_cashfree_to_wallet_transactions.sql
```

## API Endpoints

### 1. Create Cashfree Order

**Endpoint:** `POST /api/wallet/create-cashfree-order`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 100,
  "currency": "INR" // or "USD"
}
```

**Response:**
```json
{
  "orderId": "wallet_2_1234567890",
  "paymentSessionId": "session_xxx",
  "orderAmount": 100.00,
  "currency": "INR",
  "userAmount": 100,
  "userCurrency": "INR",
  "returnUrl": "https://yourdomain.com/payment-return?gateway=cashfree"
}
```

### 2. Verify Cashfree Payment

**Endpoint:** `POST /api/wallet/verify-cashfree-payment`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "orderId": "wallet_2_1234567890",
  "paymentId": "payment_xxx",
  "orderAmount": "100.00",
  "referenceId": "ref_xxx",
  "txStatus": "SUCCESS",
  "paymentMode": "UPI",
  "txMsg": "Payment successful",
  "txTime": "2024-01-01T12:00:00Z",
  "signature": "signature_hash"
}
```

**Response:**
```json
{
  "message": "Wallet credited successfully",
  "amount": 100.00,
  "amountFormatted": "₹100.00",
  "currency": "INR"
}
```

### 3. Cashfree Webhook

**Endpoint:** `POST /api/wallet/webhooks/cashfree`

**Headers:**
```
x-cashfree-signature: signature_hash
Content-Type: application/json
```

**Note:** This endpoint does not require authentication. Cashfree will send webhook notifications here when payment status changes.

## Flow

### Payment Flow

1. **User initiates payment:**
   - Frontend calls `POST /api/wallet/create-cashfree-order` with amount and currency
   - Backend creates a Cashfree order and returns `paymentSessionId`

2. **User completes payment:**
   - Frontend redirects user to Cashfree hosted checkout page using `paymentSessionId`
   - User completes payment on Cashfree

3. **Payment verification:**
   - After payment, Cashfree redirects to `returnUrl` with payment details
   - Frontend calls `POST /api/wallet/verify-cashfree-payment` to verify and credit wallet
   - Cashfree also sends webhook to `notifyUrl` for async verification

4. **Wallet credited:**
   - Backend verifies payment signature
   - Credits the appropriate wallet (INR or USD based on user's currency preference)
   - Updates transaction status to 'completed'

## Currency Handling

- Cashfree always processes payments in INR
- If user's currency preference is USD, backend converts USD to INR for Cashfree payment
- Amount is stored in user's preferred currency wallet (USD cents or INR paise)
- Frontend displays amount in user's preferred currency

Example:
- User enters $10 USD
- Backend converts: $10 × 83 = ₹830
- Cashfree processes ₹830 payment
- ₹830 is stored as 830 INR paise OR 1000 USD cents (depending on user preference)

## Testing (Sandbox)

### Test Cards

Cashfree sandbox provides test cards and UPI IDs for testing. Refer to Cashfree sandbox documentation for test credentials.

### Test Scenarios

1. **Successful Payment:**
   - Use valid test credentials
   - Payment should complete and wallet should be credited

2. **Failed Payment:**
   - Use invalid/expired test credentials
   - Payment should fail and wallet should not be credited

3. **Webhook Testing:**
   - Cashfree sandbox will send webhook notifications
   - Verify webhook signature before processing

## Files Modified/Added

1. **services/cashfreeServices.js** - Cashfree service implementation
2. **controllers/wallet.controllers.js** - Added Cashfree endpoints
3. **routes/wallet.routes.js** - Added Cashfree routes
4. **config/db.js** - Updated wallet_transactions table schema
5. **migrations/add_cashfree_to_wallet_transactions.sql** - Migration file

## Error Handling

- Invalid amount: Returns 400 error
- Missing credentials: Service won't initialize (logs warning)
- Payment verification failure: Returns 400 error with details
- Database errors: Returns 500 error with error message

## Security

- All payment signatures are verified using HMAC SHA-256
- Webhook signatures are verified before processing
- Transaction IDs are unique and include timestamp
- Payment amounts are validated before processing

## Support

For Cashfree API documentation, visit:
- Sandbox: https://sandbox.cashfree.com
- Documentation: https://docs.cashfree.com
- Dashboard: https://merchant.cashfree.com

