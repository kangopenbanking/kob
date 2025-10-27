# Developer Testing Guide - Kang Open Banking Platform

## Overview

This guide provides comprehensive testing credentials and instructions for developers working with the Kang Open Banking (KOB) platform in sandbox mode.

---

## Test Credentials

### Test Financial Institutions

All test institutions are pre-configured in sandbox mode with proper credentials:

#### 1. Commercial Bank of Cameroon (Test)
- **Institution Type:** Bank
- **Client ID:** `test_cbc_client_001`
- **Client Secret:** `test_cbc_secret_001`
- **Registration Number:** RC/YAO/2024/TEST001
- **BIC Code:** CBCMCMCX
- **API Base URL:** https://api-sandbox.cbc-cm.example.com
- **Location:** Yaoundé, Cameroon

#### 2. Afriland First Bank (Test)
- **Institution Type:** Bank
- **Client ID:** `test_afb_client_001`
- **Client Secret:** `test_afb_secret_001`
- **Registration Number:** RC/DLA/2024/TEST002
- **BIC Code:** CCEYCMCX
- **API Base URL:** https://api-sandbox.afrilandfirstbank.example.com
- **Location:** Douala, Cameroon

#### 3. MTN Mobile Money (Test)
- **Institution Type:** Fintech (Mobile Money)
- **Client ID:** `test_mtn_client_001`
- **Client Secret:** `test_mtn_secret_001`
- **Registration Number:** RC/YAO/2024/TEST003
- **API Base URL:** https://api-sandbox.mtn-momo.example.com
- **Location:** Yaoundé, Cameroon

#### 4. Orange Money (Test)
- **Institution Type:** Fintech (Mobile Money)
- **Client ID:** `test_orange_client_001`
- **Client Secret:** `test_orange_secret_001`
- **Registration Number:** RC/DLA/2024/TEST004
- **API Base URL:** https://api-sandbox.orange-money.example.com
- **Location:** Douala, Cameroon

#### 5. Express Union Finance (Test)
- **Institution Type:** Credit Union (Microfinance)
- **Client ID:** `test_eu_client_001`
- **Client Secret:** `test_eu_secret_001`
- **Registration Number:** RC/YAO/2024/TEST005
- **API Base URL:** https://api-sandbox.expressunion.example.com
- **Location:** Yaoundé, Cameroon

---

## Test OAuth Clients

Pre-configured OAuth 2.0 clients for API testing:

### 1. AISP Client (Account Information)
- **Client ID:** `test_aisp_client_001`
- **Client Secret:** `test_aisp_secret_001`
- **Client Type:** AISP
- **Scopes:** accounts, transactions, balances
- **Redirect URIs:** 
  - http://localhost:5173/callback
  - https://oauth.pstmn.io/v1/callback
- **Grant Types:** authorization_code, refresh_token

### 2. PISP Client (Payment Initiation)
- **Client ID:** `test_pisp_client_001`
- **Client Secret:** `test_pisp_secret_001`
- **Client Type:** PISP
- **Scopes:** payments
- **Redirect URIs:**
  - http://localhost:5173/callback
  - https://oauth.pstmn.io/v1/callback
- **Grant Types:** authorization_code, refresh_token

### 3. Combined AISP+PISP Client
- **Client ID:** `test_combined_client_001`
- **Client Secret:** `test_combined_secret_001`
- **Client Type:** Combined
- **Scopes:** accounts, transactions, balances, payments
- **Redirect URIs:**
  - http://localhost:5173/callback
  - https://oauth.pstmn.io/v1/callback
- **Grant Types:** authorization_code, refresh_token

---

## Testing Bank Sync Operations

### 1. REST API Sync

**Supported:** ✅ Fully Functional

**How to Test:**
1. Navigate to Banking Operations dashboard
2. Create a bank connection with type "REST_API"
3. Use any test institution credentials
4. Click "Sync Now" button
5. Verify transactions are fetched successfully

**Configuration Requirements:**
- `connection_type`: "REST_API"
- `base_url`: Bank API base URL
- `connection_config.api_key`: API authentication key

### 2. SFTP Sync

**Supported:** ⚠️ Framework Ready (Implementation Pending)

**How to Test:**
1. Create a bank connection with type "SFTP"
2. Configure SFTP connection details:
   ```json
   {
     "sftp_host": "sftp.bank.example.com",
     "sftp_port": 22,
     "sftp_username": "username",
     "sftp_password": "password",
     "sftp_remote_path": "/transactions",
     "sftp_file_pattern": "*.csv"
   }
   ```
3. Trigger sync operation
4. Review sync result (framework response with next steps)

**Current Status:**
- ✅ Connection framework implemented
- ✅ Configuration validation
- ✅ Metadata logging
- ⚠️ File download and parsing pending

**Next Steps for Full Implementation:**
1. Install SFTP client library (e.g., ssh2-sftp-client)
2. Implement file download logic
3. Add CSV/XML parser for transaction files
4. Map bank data to transaction schema

### 3. H2H (Host-to-Host) Sync

**Supported:** ✅ Multiple Authentication Methods

**How to Test:**
1. Create a bank connection with type "H2H"
2. Configure H2H connection details based on authentication method

**Authentication Methods:**

#### a) Mutual TLS (mTLS)
```json
{
  "h2h_auth_method": "mutual_tls",
  "h2h_client_cert": "-----BEGIN CERTIFICATE-----...",
  "h2h_client_key": "-----BEGIN PRIVATE KEY-----...",
  "h2h_endpoint": "/api/transactions"
}
```

#### b) API Key Authentication
```json
{
  "h2h_auth_method": "api_key",
  "api_key": "your_api_key",
  "api_secret": "your_api_secret",
  "h2h_endpoint": "/api/transactions"
}
```

#### c) HMAC Signature
```json
{
  "h2h_auth_method": "hmac",
  "hmac_signature": "calculated_signature",
  "h2h_endpoint": "/api/transactions"
}
```

#### d) OAuth 2.0 Client Credentials
```json
{
  "h2h_auth_method": "oauth2",
  "access_token": "bearer_token",
  "h2h_endpoint": "/api/transactions"
}
```

**Request Format:**
The H2H sync sends a POST request with:
```json
{
  "request_type": "transaction_sync",
  "from_date": "2024-10-20T00:00:00Z",
  "to_date": "2024-10-27T23:59:59Z",
  "account_ids": ["account1", "account2"]
}
```

---

## OAuth 2.0 Testing Flow

### Step 1: Authorization Request

```http
GET /oauth/authorize
  ?response_type=code
  &client_id=test_aisp_client_001
  &redirect_uri=http://localhost:5173/callback
  &scope=accounts transactions balances
  &state=random_state_string
```

### Step 2: User Authorization
- User logs in and authorizes consent
- User is redirected to `redirect_uri` with authorization code

### Step 3: Token Exchange

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=http://localhost:5173/callback
&client_id=test_aisp_client_001
&client_secret=test_aisp_secret_001
```

### Step 4: Access API with Token

```http
GET /aisp/accounts
Authorization: Bearer ACCESS_TOKEN
```

---

## API Testing with Postman

### Import Collection
1. Download the KOB API Postman collection
2. Import into Postman
3. Set environment variables:
   - `base_url`: https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1
   - `client_id`: test_aisp_client_001
   - `client_secret`: test_aisp_secret_001

### Test Sequence
1. **Generate CAPTCHA** → `POST /captcha-generate`
2. **Verify CAPTCHA** → `POST /captcha-verify`
3. **Create Consent** → `POST /aisp-create-consent`
4. **Authorize Consent** → `POST /consent-authorize`
5. **Get Access Token** → `POST /oauth-token`
6. **Fetch Accounts** → `GET /aisp-accounts`
7. **Fetch Transactions** → `GET /aisp-transactions`

---

## Database Security Notes

### RLS Policies
Some tables have intentionally minimal RLS policies for security:
- **System-only tables:** `authorization_codes`, `par_requests`, `rate_limits`
- **Admin-only tables:** `sanctions_screening`, `incident_logs`, `regulatory_reports`
- **ISO20022 tables:** Restricted to admin/system access only

This is **by design** to ensure maximum security. Regular users cannot access these tables directly.

### Password Security
- A password validation function is available: `validate_password_strength(password TEXT)`
- Requirements: 8+ chars, uppercase, lowercase, number, special character
- **Important:** Enable "Leaked Password Protection" in your authentication settings

---

## Common Testing Scenarios

### 1. Account Information (AISP)
```javascript
// Step 1: Create consent
const consent = await supabase.functions.invoke('aisp-create-consent', {
  body: {
    permissions: ['ReadAccounts', 'ReadTransactions', 'ReadBalances'],
    expiration_date: '2025-10-27'
  }
});

// Step 2: Authorize (user action)
// Step 3: Fetch accounts
const accounts = await supabase.functions.invoke('aisp-accounts', {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

### 2. Payment Initiation (PISP)
```javascript
// Step 1: Create payment consent
const consent = await supabase.functions.invoke('pisp-create-consent', {
  body: {
    amount: 10000,
    currency: 'XAF',
    creditor_account: '237670000000',
    payment_reference: 'TEST-PAY-001'
  }
});

// Step 2: Submit payment
const payment = await supabase.functions.invoke('pisp-payment-submission', {
  headers: { Authorization: `Bearer ${accessToken}` },
  body: { consent_id: consent.data.consent_id }
});
```

### 3. Mobile Money Operations
```javascript
// Charge mobile money
const charge = await supabase.functions.invoke('mobile-money-charge', {
  body: {
    phone_number: '+237670000000',
    amount: 5000,
    currency: 'XAF',
    reference: 'TEST-MOMO-001'
  }
});

// Transfer to bank
const transfer = await supabase.functions.invoke('mobile-money-to-bank', {
  body: {
    source_phone: '+237670000000',
    destination_account: '1234567890',
    amount: 5000,
    bank_code: 'CBC'
  }
});
```

---

## Edge Function Testing

All 43 edge functions are now registered and accessible:

### Authentication & Security
- `phone-auth-send-otp`
- `phone-auth-verify-otp`
- `pin-code-set`
- `pin-code-verify`
- `captcha-generate`
- `captcha-verify`
- `sca-initiate`
- `sca-verify`

### Account Information (AISP)
- `aisp-accounts`
- `aisp-balances`
- `aisp-transactions`
- `aisp-beneficiaries`
- `aisp-standing-orders`
- `aisp-direct-debits`

### Payment Initiation (PISP)
- `pisp-domestic-payment`
- `pisp-payment-details`
- `pisp-payment-submission`

### Banking Operations
- `bank-sync` (REST, SFTP, H2H)
- `bank-reconcile`
- `bank-import-transactions`
- `bulk-transfers`

### Payment Integrations
- `flutterwave-list-banks`
- `flutterwave-verify-bank`
- `flutterwave-bank-transfer`
- `stripe-payment-intent`
- `stripe-confirm-payment`
- `stripe-save-card`

### ISO20022 & SWIFT
- `iso20022-pain001-parser`
- `iso20022-camt053-parser`
- `iso20022-pacs008-generator`
- `iso20022-pacs002-generator`
- `swift-mt103-parser`
- `swift-mt940-parser`
- `swift-mt103-generator`

---

## Troubleshooting

### Issue: OAuth token endpoint returns 401
**Solution:** Verify that:
- Client credentials are correct
- Edge function `oauth-token` has `verify_jwt = false` in config
- Authorization code hasn't expired

### Issue: Bank sync fails
**Solution:** Check:
- Bank connection status is "active"
- Connection credentials are valid
- Base URL is accessible
- For SFTP: Host/port/credentials are correct
- For H2H: Authentication method matches configuration

### Issue: API calls return "consent not found"
**Solution:** Ensure:
- Consent was created successfully
- Consent was authorized by user
- Consent hasn't expired
- Consent ID matches the one used in API call

---

## Support & Documentation

- **API Reference:** https://your-domain.com/developer
- **Developer Portal:** Navigate to `/developer` in the application
- **API Console:** Navigate to `/developer/api-console` for live testing
- **Code Examples:** Navigate to `/developer/code-examples`

---

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for sensitive data
3. **Implement proper error handling** in production
4. **Enable leaked password protection** in authentication settings
5. **Review RLS policies** before going to production
6. **Test with sandbox credentials** only
7. **Monitor API usage** through the admin dashboard

---

## Next Steps

1. ✅ Review test credentials
2. ✅ Test OAuth flow with Postman
3. ✅ Implement your application using test clients
4. ✅ Test bank sync operations
5. ✅ Verify transactions and payments
6. ✅ Review security policies
7. ✅ Request production credentials when ready

---

**Last Updated:** 2025-10-27  
**Version:** 1.0.0  
**Platform:** Kang Open Banking (KOB)
