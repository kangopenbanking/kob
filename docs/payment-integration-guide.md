# Payment Integration Guide

## Overview

KOB (Kang Open Banking) is an **XAF-native** gateway for the CEMAC region.
Cameroon (XAF) is the default currency and country for every example below.
Other currencies are supported for cross-border flows but should be treated
as opt-in.

Supported payment methods:
- **Mobile Money** (via Flutterwave) - MTN MoMo, Orange Money — XAF first
- **Credit/Debit Cards** (via Stripe) - International card payments in XAF
- **Bank Transfers** (via Flutterwave) - CEMAC bank rails (RIB), plus regional fallbacks

---

## 1. Mobile Money Payments

### Supported Currencies
- **XAF** - Central African CFA Franc (Cameroon, **default**)
- **XOF** - West African CFA Franc
- GHS - Ghanaian Cedi
- KES - Kenyan Shilling
- UGX - Ugandan Shilling
- TZS - Tanzanian Shilling
- ZAR - South African Rand
- RWF - Rwandan Franc
- NGN - Nigerian Naira (cross-border only; not the primary KOB market)

### Supported Providers
- MTN Mobile Money
- Orange Money

### Supported Countries
Cameroon, Nigeria, Ghana, Kenya, Uganda, Tanzania, South Africa, Rwanda

### Transaction Types

#### Charge (Collection)
Collect money from a customer's mobile money account.

**API Endpoint:** `mobile-money-charge`

**Request:**
```json
{
  "amount": 1000,
  "phone_number": "237670000000",
  "provider": "mtn",
  "currency": "XAF",
  "description": "Payment for services"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "uuid",
    "transaction_ref": "MMC_...",
    "flutterwave_ref": "FLW...",
    "status": "processing",
    "payment_link": "https://...",
    "message": "Please complete payment on your mobile device"
  }
}
```

#### Transfer (Payout)
Send money to a customer's mobile money account.

**API Endpoint:** `mobile-money-transfer`

**Request:**
```json
{
  "amount": 5000,
  "phone_number": "237670000000",
  "provider": "orange",
  "currency": "XAF",
  "description": "Refund payment",
  "beneficiary_name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "uuid",
    "transaction_ref": "MMT_...",
    "flutterwave_ref": "12345",
    "status": "processing",
    "message": "Transfer initiated successfully"
  }
}
```

---

## 2. Credit/Debit Card Payments

### Supported Cards
- Visa
- Mastercard
- American Express
- Other major card brands supported by Stripe

### Supported Currencies
- **USD** - US Dollar
- **EUR** - Euro
- **GBP** - British Pound
- Plus 135+ other currencies supported by Stripe

### Features
- ✅ One-time payments
- ✅ Save card for future use (tokenized)
- ✅ 3D Secure authentication
- ✅ Real-time payment confirmation
- ✅ Automatic fee recording

### Transaction Flow

#### Create Payment Intent

**API Endpoint:** `stripe-payment-intent`

**Request:**
```json
{
  "amount": 100.50,
  "currency": "USD",
  "description": "Product purchase",
  "save_card": true
}
```

**Response:**
```json
{
  "client_secret": "pi_..._secret_...",
  "payment_intent_id": "pi_...",
  "transaction_ref": "CARD-..."
}
```

#### Confirm Payment (Frontend)
Use Stripe.js to confirm the payment with the `client_secret`:

```javascript
const result = await stripe.confirmCardPayment(client_secret, {
  payment_method: {
    card: cardElement,
  }
});
```

#### Webhook Handler
Stripe sends webhooks to `stripe-confirm-payment` endpoint for payment status updates:
- `payment_intent.succeeded` - Payment successful
- `payment_intent.payment_failed` - Payment failed

### Security
- PCI DSS Level 1 compliant (Stripe handles card data)
- Cards are tokenized (never stored in database)
- 3D Secure 2.0 support for SCA compliance

---

## 3. Bank Transfer

### Supported Banks
Fetched dynamically based on selected currency/country via Flutterwave API.

### Supported Currencies
- **XAF** - Central African CFA Franc (Cameroon / CEMAC banks, **default**)
- **XOF** - West African CFA Franc (UEMOA banks)
- GHS - Ghanaian Cedi (Ghanaian banks)
- KES - Kenyan Shilling (Kenyan banks)
- UGX - Ugandan Shilling (Ugandan banks)
- TZS - Tanzanian Shilling (Tanzanian banks)
- ZAR - South African Rand (South African banks)
- NGN - Nigerian Naira (cross-border only; not the primary KOB market)

### Transaction Flow

#### List Banks

**API Endpoint:** `flutterwave-list-banks`

**Request:**
```json
{
  "country": "CM"
}
```

**Response:**
```json
{
  "banks": [
    {
      "id": "10001",
      "code": "10001",
      "name": "Afriland First Bank"
    }
  ],
  "country": "CM"
}
```

#### Verify Account

**API Endpoint:** `flutterwave-verify-bank`

**Request:**
```json
{
  "account_number": "1234567890",
  "account_bank": "10001"
}
```

**Response:**
```json
{
  "account_name": "John Doe",
  "account_number": "1234567890"
}
```

#### Initiate Transfer

**API Endpoint:** `flutterwave-bank-transfer`

**Request:**
```json
{
  "account_bank": "10001",
  "account_number": "1234567890",
  "amount": 50000,
  "currency": "XAF",
  "narration": "Payment for services",
  "beneficiary_name": "John Doe",
  "bank_name": "Afriland First Bank"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_ref": "BANK-...",
  "flutterwave_ref": "FLW...",
  "status": "processing",
  "message": "Transfer initiated successfully"
}
```

### Settlement Times
- **Instant**: Some banks support instant settlement
- **1-3 business days**: Standard bank transfer processing time

---

### Mobile Money to Bank Transfers

Transfer funds from mobile money wallets directly to bank accounts.

**Supported Currencies:**
- XAF (Central African CFA Franc) — **Default**
- XOF (West African CFA Franc)
- GHS, KES, UGX, TZS, ZAR, RWF (regional)
- NGN (cross-border only)

**Provider Support:**
- **MTN**: XAF (primary), XOF, GHS, UGX, RWF, ZAR, NGN
- **Orange Money**: XAF (primary), XOF, GHS, NGN

**API Endpoint:**
```
POST /functions/v1/mobile-money-to-bank
```

**Request:**
```json
{
  "source_mobile_account_id": "uuid",
  "destination_account_id": "uuid",
  "amount": 10000,
  "currency": "XAF",
  "description": "Savings deposit"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mobile_transaction_id": "uuid",
    "transaction_ref": "MMTB-xxx",
    "payment_link": "https://...",
    "status": "processing",
    "message": "Payment link generated. Complete payment to credit your bank account."
  }
}
```

**Transaction Flow:**
1. User initiates transfer via API
2. System generates Flutterwave payment link
3. User completes payment on mobile device
4. Webhook confirms payment status
5. Bank account automatically credited
6. User receives confirmation notification

---

## Fee Management

All payment methods integrate with KOB's fee management system:

### Transaction Types for Fee Calculation
- `mobile_money_charge`
- `mobile_money_transfer`
- `card_payment`
- `bank_transfer`

### Automatic Fee Recording
Fees are automatically recorded when:
1. User belongs to an institution
2. Institution has active fee structures
3. Transaction completes successfully

---

## Frontend Integration

### Using the Unified Payments Page

Navigate to `/payments` to access all three payment methods in a single interface with tabs.

### Individual Components

#### Mobile Money
```tsx
import MobileMoney from "@/pages/MobileMoney";
```

#### Card Payment
```tsx
import { CardPaymentForm } from "@/components/payments/CardPaymentForm";
```

#### Bank Transfer
```tsx
import { BankTransferForm } from "@/components/payments/BankTransferForm";
```

---

## Error Handling

### Common Error Codes
- `MOBILE_MONEY_CHARGE_ERROR` - Mobile money charge failed
- `MOBILE_MONEY_TRANSFER_ERROR` - Mobile money transfer failed
- `STRIPE_PAYMENT_INTENT_ERROR` - Stripe payment intent creation failed
- `STRIPE_WEBHOOK_ERROR` - Stripe webhook processing failed
- `FLUTTERWAVE_BANK_TRANSFER_ERROR` - Bank transfer initiation failed
- `FLUTTERWAVE_VERIFY_BANK_ERROR` - Bank account verification failed
- `FLUTTERWAVE_LIST_BANKS_ERROR` - Failed to fetch bank list

### Error Response Format
```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}
```

---

## Testing

### Test Credentials

#### Flutterwave Test Cards
- **Card Number:** 5531 8866 5214 2950
- **CVV:** 564
- **Expiry:** 09/32
- **Pin:** 3310
- **OTP:** 12345

#### Stripe Test Cards
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0027 6000 3184

### Test Mode
All payment providers support test mode with sandbox credentials.

---

## Security Best Practices

1. **Never store card details** - Use tokenization
2. **Validate all inputs** - Server-side validation
3. **Use HTTPS** - All payment requests over secure connections
4. **Implement idempotency** - Prevent duplicate transactions
5. **Monitor webhooks** - Set up alerts for failed webhooks
6. **Log all transactions** - Maintain audit trail
7. **Implement rate limiting** - Prevent abuse
8. **Use SCA** - Strong Customer Authentication for cards

---

## Support

For integration support:
- Email: support@kangopenbanking.com
- Documentation: https://docs.kangopenbanking.com
- Status Page: https://status.kangopenbanking.com

---

## Changelog

### Version 1.0.0 (2025-01-XX)
- Multi-currency mobile money support (8 currencies)
- Stripe card payment integration
- Flutterwave bank transfer integration
- Unified payment interface
- Automatic fee recording
- Account verification for bank transfers
