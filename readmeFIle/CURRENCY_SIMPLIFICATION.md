# Currency Simplification - Complete Rewrite

## Overview

This document describes the complete rewrite of the billing, wallet, and transaction system to eliminate currency confusion and simplify the codebase.

## Key Principle

**All backend computations are done in INR only. Currency conversion happens only at the display layer (API response).**

## Architecture Changes

### 1. Database Schema Simplification

#### Before:
- Multiple currency fields in tables (`wallets.currency`, `billing_logs.currency`, etc.)
- Separate tables for USD and INR billing logs
- Currency confusion in calculations

#### After:
- All amounts stored in **INR paise** (INR * 100)
- Single `billing_logs` table (no currency separation)
- `users.currency` field retained **only for display preference** (not for storage)
- Removed currency fields from:
  - `wallets` table
  - `billing_logs` table
  - `user_billing_summary` table
  - `monthly_invoices` table

### 2. Storage Format

- **All amounts stored in INR paise** (e.g., ₹100 = 10000 paise)
- No USD storage - USD is converted to INR before storage
- Conversion rate: 1 USD = 83 INR (configurable via `USD_TO_INR_RATE` env var)

### 3. Currency Conversion Utility

New file: `utils/currencyUtils.js`

Provides:
- `convertToStorageUnits(amount, userCurrency)` - Converts user input to INR paise
- `formatForDisplay(inrPaise, displayCurrency)` - Converts stored INR paise to display currency
- All conversion happens in one place

### 4. Services Rewritten

#### Billing Service (`services/billingServices.js`)
- All computations in INR paise
- No currency confusion in calculations
- Simplified GST calculations
- Single currency flow

#### Wallet Controller (`controllers/wallet.controllers.js`)
- Stores all amounts in INR paise
- Converts to USD only at API response time
- Handles user input in USD/INR and converts to INR before storage

#### Tax Service (`services/taxServices.js`)
- Simplified to work only in INR
- GST calculations in INR only
- Display formatting handled by currency utility

## API Response Format

All API responses now include:
- `amount`: Value in user's display currency (USD or INR)
- `amountFormatted`: Formatted string (e.g., "$10.500" or "₹100.00")
- `currency`: Display currency ("USD" or "INR")
- `rawAmount`: Original INR paise (for reference/debugging)

### Example Response:

```json
{
  "balance": 10.833,
  "balanceFormatted": "$10.833",
  "currency": "USD",
  "rawBalance": 90000
}
```

Where:
- User prefers USD
- Balance stored as 90000 INR paise (₹900)
- Displayed as $10.833 (900 / 83)

## Migration Notes

### Database Changes

Since the database is empty, the following changes were made:

1. **Removed currency fields** from tables that don't need them
2. **Kept `users.currency`** field for display preference only
3. **All amounts now stored in INR paise**

### Code Changes

1. **All billing calculations** now work in INR only
2. **Currency conversion** happens at API response layer
3. **Wallet transactions** stored in INR paise
4. **Promo codes** stored in INR paise
5. **Invoice amounts** stored in INR paise

## Benefits

1. **No Currency Confusion**: All backend logic works in one currency
2. **Easier Debugging**: Single currency makes calculations predictable
3. **Simplified Code**: No currency branches in business logic
4. **Consistent Storage**: All amounts in same format
5. **Flexible Display**: Easy to add more currencies in future (display only)

## How It Works

### User with USD Preference:

1. User enters amount: $10 USD
2. Backend converts to INR: $10 × 83 = ₹830 = 83000 paise
3. Amount stored as: 83000 INR paise
4. When displaying:
   - Fetch from DB: 83000 INR paise
   - Convert: 83000 / 100 / 83 = $10.000 USD
   - Return to frontend: `{ amount: 10.000, currency: "USD" }`

### User with INR Preference:

1. User enters amount: ₹100 INR
2. Backend stores as: 10000 INR paise
3. When displaying:
   - Fetch from DB: 10000 INR paise
   - Convert: 10000 / 100 = ₹100.00 INR
   - Return to frontend: `{ amount: 100.00, currency: "INR" }`

## Payment Processing

- **Razorpay**: Always uses INR (required by Razorpay)
- User enters amount in their preferred currency
- Converted to INR before creating Razorpay order
- Payment processed in INR
- Stored in INR paise

## Files Changed

### New Files:
- `utils/currencyUtils.js` - Currency conversion utility

### Rewritten Files:
- `services/billingServices.js` - Simplified billing service
- `controllers/wallet.controllers.js` - Simplified wallet controller
- `services/taxServices.js` - Simplified tax service
- `config/db.js` - Simplified database schema

### Files to Update:
- Frontend components (will receive converted amounts)
- Admin controllers (may need currency conversion for display)
- Invoice generation (should use currency utility)

## Testing Checklist

- [ ] Wallet balance display (INR users)
- [ ] Wallet balance display (USD users)
- [ ] Wallet top-up (INR users)
- [ ] Wallet top-up (USD users)
- [ ] Server deployment billing
- [ ] Hourly server billing
- [ ] Billing history display
- [ ] Transaction history display
- [ ] Promo code application
- [ ] Invoice generation and display
- [ ] Admin dashboard (currency conversion)

## Environment Variables

Add to `.env`:
```
USD_TO_INR_RATE=83
```

## Notes

- Conversion rate is configurable via environment variable
- All amounts are rounded appropriately (INR: 2 decimals, USD: 3 decimals)
- Frontend receives amounts already converted - no conversion needed in frontend
- Admin panel should convert amounts for display if showing in different currency

