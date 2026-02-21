const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Helper to create a request item
const r = (name: string, method: string, path: string, opts?: {
  body?: Record<string, unknown>;
  bodyMode?: 'raw' | 'urlencoded';
  urlencoded?: { key: string; value: string }[];
  query?: { key: string; value: string }[];
  desc?: string;
  headers?: { key: string; value: string }[];
}) => {
  const item: Record<string, unknown> = {
    name,
    request: {
      method,
      header: [
        ...(opts?.bodyMode === 'urlencoded'
          ? [{ key: 'Content-Type', value: 'application/x-www-form-urlencoded' }]
          : method !== 'GET' ? [{ key: 'Content-Type', value: 'application/json' }] : []),
        ...(opts?.headers || []),
      ],
      url: {
        raw: `{{base_url}}${path}${opts?.query?.length ? '?' + opts.query.map(q => `${q.key}=${q.value}`).join('&') : ''}`,
        host: ['{{base_url}}'],
        path: path.split('/').filter(Boolean),
        ...(opts?.query?.length ? { query: opts.query } : {}),
      },
      ...(opts?.desc ? { description: opts.desc } : {}),
    },
  };

  if (opts?.body) {
    (item.request as Record<string, unknown>).body = {
      mode: 'raw',
      raw: JSON.stringify(opts.body, null, 2),
    };
  } else if (opts?.urlencoded) {
    (item.request as Record<string, unknown>).body = {
      mode: 'urlencoded',
      urlencoded: opts.urlencoded,
    };
  }

  return item;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const collection = {
    info: {
      name: 'Kang Open Banking API v1',
      description: 'Complete Postman collection for the KOB API – aligned 1:1 with the OpenAPI 3.1 spec. COBAC & BEAC compliant.',
      version: '1.0.0',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{access_token}}', type: 'string' }] },
    variable: [
      { key: 'base_url', value: 'https://api.kangopenbanking.com', type: 'string' },
      { key: 'access_token', value: 'YOUR_ACCESS_TOKEN', type: 'string' },
      { key: 'user_id', value: 'USER_UUID', type: 'string' },
      { key: 'account_id', value: 'ACCOUNT_UUID', type: 'string' },
      { key: 'product_id', value: 'PRODUCT_UUID', type: 'string' },
      { key: 'loan_id', value: 'LOAN_UUID', type: 'string' },
      { key: 'consent_id', value: 'CONSENT_ID', type: 'string' },
      { key: 'payment_id', value: 'PAYMENT_UUID', type: 'string' },
      { key: 'certificate_id', value: 'CERTIFICATE_UUID', type: 'string' },
      { key: 'tpp_registration_id', value: 'TPP_UUID', type: 'string' },
      { key: 'institution_id', value: 'INSTITUTION_UUID', type: 'string' },
      { key: 'webhook_id', value: 'WEBHOOK_UUID', type: 'string' },
      { key: 'branch_id', value: 'BRANCH_UUID', type: 'string' },
      { key: 'merchant_id', value: 'MERCHANT_UUID', type: 'string' },
      { key: 'charge_id', value: 'CHARGE_UUID', type: 'string' },
      { key: 'payout_id', value: 'PAYOUT_UUID', type: 'string' },
      { key: 'batch_id', value: 'BATCH_UUID', type: 'string' },
      { key: 'refund_id', value: 'REFUND_UUID', type: 'string' },
      { key: 'dispute_id', value: 'DISPUTE_UUID', type: 'string' },
      { key: 'settlement_id', value: 'SETTLEMENT_UUID', type: 'string' },
      { key: 'beneficiary_id', value: 'BENEFICIARY_UUID', type: 'string' },
    ],
    item: [
      // ── Monitoring ─────────────────────────────────────────────────
      {
        name: 'Monitoring',
        item: [
          r('Health Check', 'GET', '/v1/health', { desc: 'API health probe' }),
          r('Readiness Probe', 'GET', '/v1/ready', { desc: 'Readiness probe – checks DB connectivity' }),
          r('System Health', 'GET', '/v1/system-health', { desc: 'Detailed system health (auth required)' }),
        ],
      },

      // ── OAuth & Authentication ──────────────────────────────────────
      {
        name: 'OAuth',
        item: [
          r('Get Access Token', 'POST', '/v1/oauth/token', {
            bodyMode: 'urlencoded',
            urlencoded: [
              { key: 'grant_type', value: 'authorization_code' },
              { key: 'client_id', value: 'YOUR_CLIENT_ID' },
              { key: 'client_secret', value: 'YOUR_CLIENT_SECRET' },
              { key: 'code', value: 'AUTH_CODE' },
            ],
          }),
          r('Introspect Token', 'POST', '/v1/oauth/introspect', {
            bodyMode: 'urlencoded',
            urlencoded: [{ key: 'token', value: '{{access_token}}' }],
          }),
          r('Pushed Authorization Request', 'POST', '/v1/oauth/par', {
            bodyMode: 'urlencoded',
            urlencoded: [
              { key: 'client_id', value: 'YOUR_CLIENT_ID' },
              { key: 'response_type', value: 'code' },
              { key: 'redirect_uri', value: 'https://yourapp.com/callback' },
              { key: 'scope', value: 'openid accounts payments' },
            ],
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Dynamic Client Registration', 'POST', '/v1/dcr/register', {
            body: { client_name: 'FinTech App Cameroun', redirect_uris: ['https://app.example.com/callback'], grant_types: ['authorization_code'] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('OIDC Discovery', 'GET', '/v1/oidc/.well-known/openid-configuration'),
          r('JWKS Endpoint', 'GET', '/v1/jwks'),
        ],
      },

      // ── Phone Auth ──────────────────────────────────────────────────
      {
        name: 'Authentication',
        item: [
          r('Send OTP', 'POST', '/v1/auth/phone/send-otp', { body: { phone_number: '+237670000000' } }),
          r('Verify OTP', 'POST', '/v1/auth/phone/verify-otp', { body: { phone_number: '+237670000000', otp_code: '123456' } }),
          r('PIN Login', 'POST', '/v1/auth/phone/pin-login', { body: { phone_number: '+237670000000', pin: '1234' } }),
          r('Set PIN', 'POST', '/v1/auth/pin/set', { body: { pin: '1234' } }),
          r('Verify PIN', 'POST', '/v1/auth/pin/verify', { body: { pin: '1234' } }),
          r('Password Reset with PIN', 'POST', '/v1/auth/password/reset-with-pin', { body: { phone_number: '+237670000000', pin: '1234', new_password: 'NewP@ss1' } }),
        ],
      },

      // ── Security ────────────────────────────────────────────────────
      {
        name: 'Security',
        item: [
          r('Generate CAPTCHA', 'POST', '/v1/security/captcha/generate'),
          r('Verify CAPTCHA', 'POST', '/v1/security/captcha/verify', { body: { challenge_id: 'ch_abc', response: '42' } }),
          r('Initiate SCA', 'POST', '/v1/security/sca/initiate', { body: { action_type: 'payment' } }),
          r('Verify SCA', 'POST', '/v1/security/sca/verify', { body: { challenge_id: 'ch_abc', response: '123456' } }),
        ],
      },

      // ── Certificates ────────────────────────────────────────────────
      {
        name: 'Certificates',
        item: [
          r('Upload Certificate', 'POST', '/v1/certificates', {
            body: { certificate_pem: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----', tpp_registration_id: '{{tpp_registration_id}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Certificates', 'GET', '/v1/certificates', { query: [{ key: 'tpp_registration_id', value: '{{tpp_registration_id}}' }] }),
          r('Revoke Certificate', 'POST', '/v1/certificates/revoke', {
            body: { certificate_id: '{{certificate_id}}', reason: 'key_compromise' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── AISP ────────────────────────────────────────────────────────
      {
        name: 'AISP (Account Information)',
        item: [
          r('Create AISP Consent', 'POST', '/v1/aisp/consents', {
            body: { permissions: ['ReadAccountsDetail', 'ReadBalances', 'ReadTransactionsDetail'], expiration_date: '2026-12-31T23:59:59Z' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Accounts', 'GET', '/v1/aisp/accounts'),
          r('Get Account Details', 'GET', '/v1/aisp/accounts/{{account_id}}'),
          r('Get Balances', 'GET', '/v1/aisp/accounts/{{account_id}}/balances'),
          r('List Transactions', 'GET', '/v1/aisp/accounts/{{account_id}}/transactions', {
            query: [{ key: 'limit', value: '25' }, { key: 'offset', value: '0' }],
          }),
          r('List Beneficiaries', 'GET', '/v1/aisp/accounts/{{account_id}}/beneficiaries'),
          r('List Standing Orders', 'GET', '/v1/aisp/accounts/{{account_id}}/standing-orders'),
          r('List Direct Debits', 'GET', '/v1/aisp/accounts/{{account_id}}/direct-debits'),
        ],
      },

      // ── PISP ────────────────────────────────────────────────────────
      {
        name: 'PISP (Payments)',
        item: [
          r('Create PISP Consent', 'POST', '/v1/pisp/consents', {
            body: { amount: 50000, currency: 'XAF', debtor_account: 'CM21100030010001234567', creditor_account: 'CM21100030020009876543' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Domestic Payment', 'POST', '/v1/pisp/domestic-payment', {
            body: { consent_id: '{{consent_id}}', amount: 50000, currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Payment Submission', 'POST', '/v1/pisp/payment-submission', {
            body: { payment_id: '{{payment_id}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Payment Details', 'GET', '/v1/pisp/payments/{{payment_id}}'),
        ],
      },

      // ── Consent Management ──────────────────────────────────────────
      {
        name: 'Consent Management',
        item: [
          r('Authorize Consent', 'POST', '/v1/consents/{{consent_id}}/authorize', {
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Revoke Consent', 'POST', '/v1/consents/{{consent_id}}/revoke', { body: { reason: 'User requested' } }),
          r('List Consents', 'GET', '/v1/consents', { query: [{ key: 'limit', value: '25' }] }),
        ],
      },

      // ── Credit Scoring ──────────────────────────────────────────────
      {
        name: 'Credit Scoring',
        item: [
          r('Get Credit Score', 'GET', '/v1/credit/score'),
          r('Calculate Credit Score', 'POST', '/v1/credit/score'),
          r('Simulate Score Impact', 'POST', '/v1/credit/simulate', { body: { action_type: 'pay_off_debt', amount: 100000 } }),
          r('Get Improvement Tips', 'GET', '/v1/credit/tips'),
          r('Generate Credit Report', 'POST', '/v1/credit/report'),
        ],
      },

      // ── Loans ───────────────────────────────────────────────────────
      {
        name: 'Loans',
        item: [
          r('List Loan Products', 'GET', '/v1/loans/products'),
          r('Apply for Loan', 'POST', '/v1/loans/apply', {
            body: { product_id: '{{product_id}}', amount: 1000000, term_months: 12, purpose: 'Business expansion' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Calculate Loan', 'POST', '/v1/loans/calculate', { body: { amount: 1000000, term_months: 12, interest_rate: 15 } }),
          r('Approve Loan', 'POST', '/v1/loans/{{loan_id}}/approve', {
            body: { approved_amount: 1000000, approved_rate: 15 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Disburse Loan', 'POST', '/v1/loans/{{loan_id}}/disburse', {
            body: { disbursement_method: 'bank_transfer' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Repayment Schedule', 'GET', '/v1/loans/{{loan_id}}/schedule'),
          r('Make Repayment', 'POST', '/v1/loans/{{loan_id}}/repay', {
            body: { amount: 92500, payment_method: 'mobile_money' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Savings ─────────────────────────────────────────────────────
      {
        name: 'Savings',
        item: [
          r('List Savings Products', 'GET', '/v1/savings/products'),
          r('Create Savings Account', 'POST', '/v1/savings/accounts', {
            body: { product_id: '{{product_id}}', initial_deposit: 50000, currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Deposit', 'POST', '/v1/savings/accounts/{{account_id}}/deposit', {
            body: { amount: 50000, source: 'mobile_money' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Withdraw', 'POST', '/v1/savings/accounts/{{account_id}}/withdraw', {
            body: { amount: 25000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Accrue Interest (cron)', 'POST', '/v1/savings/accrue-interest', {
            body: { accrual_date: '2026-02-16' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Ledger ──────────────────────────────────────────────────────
      {
        name: 'Ledger (Double-Entry)',
        item: [
          r('List Ledger Accounts', 'GET', '/v1/ledger/accounts', { query: [{ key: 'limit', value: '25' }] }),
          r('Create Ledger Account', 'POST', '/v1/ledger/accounts', {
            body: { code: '1000', name: 'Cash and Cash Equivalents', account_type: 'asset', currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Ledger Balance', 'GET', '/v1/ledger/accounts/{{account_id}}/balance'),
          r('Post Journal Entry', 'POST', '/v1/ledger/journal', {
            body: {
              entry_date: '2026-02-16',
              description: 'Loan disbursement - 1,000,000 XAF',
              reference_type: 'loan',
              lines: [
                { ledger_account_id: 'acc_loans_receivable', debit: 1000000, credit: 0 },
                { ledger_account_id: 'acc_cash', debit: 0, credit: 1000000 },
              ],
            },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Journal Entries', 'GET', '/v1/ledger/journal', { query: [{ key: 'limit', value: '25' }] }),
        ],
      },

      // ── Mobile Money ────────────────────────────────────────────────
      {
        name: 'Mobile Money',
        item: [
          r('Charge Mobile Money', 'POST', '/v1/mobile-money/charge', {
            body: { phone_number: '237650000000', amount: 5000, currency: 'XAF', provider: 'MTN' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Transfer to Mobile Money', 'POST', '/v1/mobile-money/transfer', {
            body: { phone_number: '237650000000', amount: 10000, currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Verify Transaction', 'POST', '/v1/mobile-money/verify', { body: { transaction_ref: 'TX_REF' } }),
          r('Mobile-to-Bank Transfer', 'POST', '/v1/mobile-money/to-bank', {
            body: { phone_number: '237650000000', bank_code: 'SGCM', account_number: '123456789', amount: 50000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Payments (Stripe/Flutterwave) ───────────────────────────────
      {
        name: 'Payments',
        item: [
          r('Create Payment Intent (Stripe)', 'POST', '/v1/payments/stripe/intent', {
            body: { amount: 10000, currency: 'xaf' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Confirm Payment (Stripe)', 'POST', '/v1/payments/stripe/confirm', { body: { payment_intent_id: 'pi_xxx' } }),
          r('Bank Transfer (Flutterwave)', 'POST', '/v1/payments/flutterwave/bank-transfer', {
            body: { account_number: '1234567890', bank_code: 'SGCM', amount: 50000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Banks', 'GET', '/v1/payments/flutterwave/banks', { query: [{ key: 'country', value: 'CM' }] }),
          r('Verify Bank Account', 'POST', '/v1/payments/flutterwave/verify-bank', { body: { account_number: '1234567890', bank_code: 'SGCM' } }),
        ],
      },

      // ── Banking Operations ──────────────────────────────────────────
      {
        name: 'Banking Operations',
        item: [
          r('Bulk Transfers', 'POST', '/v1/banking/bulk-transfers', {
            body: { transfers: [{ account_number: '123', bank_code: 'SGCM', amount: 10000 }] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Exchange Rate', 'GET', '/v1/banking/exchange-rate', {
            query: [{ key: 'from', value: 'XAF' }, { key: 'to', value: 'USD' }],
          }),
        ],
      },

      // ── Virtual Cards ───────────────────────────────────────────────
      {
        name: 'Virtual Cards',
        item: [
          r('Create Virtual Card', 'POST', '/v1/virtual-cards', {
            body: { currency: 'USD', initial_amount: 100 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Virtual Cards', 'GET', '/v1/virtual-cards'),
          r('Update Card Status', 'PUT', '/v1/virtual-cards/{{card_id}}/status', { body: { status: 'frozen' } }),
          r('Top Up Card', 'POST', '/v1/virtual-cards/{{card_id}}/topup', {
            body: { amount: 50, source_currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Card Transactions', 'GET', '/v1/virtual-cards/{{card_id}}/transactions'),
        ],
      },

      // ── ISO 20022 & SWIFT ───────────────────────────────────────────
      {
        name: 'Standards (ISO 20022 / SWIFT)',
        item: [
          r('Parse pain.001', 'POST', '/v1/standards/iso20022/pain001/parse', { body: { xml: '<Document>...</Document>' } }),
          r('Parse camt.053', 'POST', '/v1/standards/iso20022/camt053/parse', { body: { xml: '<Document>...</Document>' } }),
          r('Generate pacs.008', 'POST', '/v1/standards/iso20022/pacs008/generate', { body: {} }),
          r('Generate pacs.002', 'POST', '/v1/standards/iso20022/pacs002/generate', { body: {} }),
          r('Parse MT103', 'POST', '/v1/standards/swift/mt103/parse', { body: { message: '{1:F01...}' } }),
          r('Generate MT103', 'POST', '/v1/standards/swift/mt103/generate', { body: {} }),
          r('Parse MT940', 'POST', '/v1/standards/swift/mt940/parse', { body: { message: '{1:F01...}' } }),
          r('Validate BIC', 'POST', '/v1/standards/validate-bic', { body: { bic: 'SGCMCMCX' } }),
          r('Validate IBAN', 'POST', '/v1/standards/validate-iban', { body: { iban: 'CM2110003001000123456789023' } }),
        ],
      },

      // ── KYC & Compliance ────────────────────────────────────────────
      {
        name: 'KYC & Compliance',
        item: [
          r('Submit KYC', 'POST', '/v1/kyc/submit', {
            body: { document_type: 'national_id', document_number: 'NID123456' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Sanctions Screening', 'POST', '/v1/kyc/sanctions-screen', { body: { full_name: 'Jean-Pierre Kamga', nationality: 'CM' } }),
          r('Data Export (GDPR)', 'GET', '/v1/kyc/data-export'),
        ],
      },

      // ── Webhooks ────────────────────────────────────────────────────
      {
        name: 'Webhooks',
        item: [
          r('Register Webhook', 'POST', '/v1/webhooks', {
            body: { url: 'https://yourapp.com/webhooks', events: ['payment.completed', 'consent.revoked'] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Webhooks', 'GET', '/v1/webhooks'),
          r('List Webhook Deliveries', 'GET', '/v1/webhooks/{{webhook_id}}/deliveries', {
            query: [{ key: 'limit', value: '25' }],
          }),
        ],
      },

      // ── Admin ───────────────────────────────────────────────────────
      {
        name: 'Admin',
        item: [
          r('Create User', 'POST', '/v1/admin/users', {
            body: { email: 'newuser@example.com', role: 'personal', full_name: 'Test User' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Create API Client', 'POST', '/v1/admin/clients', {
            body: { client_name: 'Test Client', scopes: ['accounts', 'payments'] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Platform Metrics', 'GET', '/v1/admin/metrics'),
          r('System Config', 'GET', '/v1/admin/system-config'),
          r('Update System Config', 'PUT', '/v1/admin/system-config', { body: { key: 'value' } }),
          r('Sandbox Accounts', 'GET', '/v1/admin/sandbox/accounts'),
          r('Admin Webhooks', 'GET', '/v1/admin/webhooks'),
          r('Transaction Review', 'GET', '/v1/admin/transactions/review', { query: [{ key: 'status', value: 'flagged' }] }),
          r('Assign Staff', 'POST', '/v1/admin/staff/assign', { body: { user_id: '{{user_id}}', branch_id: '{{branch_id}}', role: 'teller' } }),
          r('List Branches', 'GET', '/v1/admin/branches'),
          r('Create Branch', 'POST', '/v1/admin/branches', {
            body: { branch_name: 'Douala Centre', branch_code: 'DLA-001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Loans (Admin)', 'GET', '/v1/admin/loans', { query: [{ key: 'status', value: 'approved' }, { key: 'limit', value: '20' }] }),
          r('List Savings (Admin)', 'GET', '/v1/admin/savings', { query: [{ key: 'status', value: 'active' }, { key: 'limit', value: '20' }] }),
          r('List Consents (Admin)', 'GET', '/v1/admin/consents', { query: [{ key: 'type', value: 'aisp' }, { key: 'status', value: 'Authorised' }] }),
        ],
      },

      // ── Communications ──────────────────────────────────────────────
      {
        name: 'Communications',
        item: [
          r('Send Communication', 'POST', '/v1/communications/send', {
            body: { type: 'email', recipient: 'user@example.com', subject: 'Test', body: 'Hello' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Send Bulk Communication', 'POST', '/v1/communications/bulk', {
            body: { subject: 'Announcement', body: 'Platform update' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Settlement ──────────────────────────────────────────────────
      {
        name: 'Settlement',
        item: [
          r('Calculate Settlement', 'POST', '/v1/settlement/calculate', {
            body: { institution_id: '{{institution_id}}', period_start: '2026-01-01T00:00:00Z', period_end: '2026-01-31T23:59:59Z' },
          }),
          r('Process Settlement', 'POST', '/v1/settlement/process', {
            body: { institution_id: '{{institution_id}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Generate Invoice', 'POST', '/v1/invoices/generate', {
            body: { institution_id: '{{institution_id}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Institution ─────────────────────────────────────────────────
      {
        name: 'Institution',
        item: [
          r('Register Institution', 'POST', '/v1/institutions/register', {
            body: { institution_name: 'Test Bank', institution_type: 'bank' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Create Institution Client', 'POST', '/v1/institutions/{{institution_id}}/clients', {
            body: { client_name: 'API Client' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Submit Business KYC', 'POST', '/v1/institutions/{{institution_id}}/kyb', {
            body: { business_name: 'Test Bank SARL', registration_number: 'RC/123' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── CrediQ ──────────────────────────────────────────────────────
      {
        name: 'CrediQ',
        item: [
          r('Health Check', 'GET', '/v1/crediq/health-check'),
          r('Generate Baseline Score', 'POST', '/v1/crediq/baseline-score'),
          r('Calculate Health Metrics', 'POST', '/v1/crediq/health-metrics'),
          r('Generate Action Plan', 'POST', '/v1/crediq/action-plan'),
        ],
      },

      // ── PostiQ ──────────────────────────────────────────────────────
      {
        name: 'PostiQ',
        item: [
          r('Create PostiQ Code', 'POST', '/v1/postiq/codes', {
            body: { address: 'Rue de la Joie, Douala' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Lookup PostiQ Code', 'GET', '/v1/postiq/codes/PIQ-ABC123'),
        ],
      },

      // ── WooCommerce ─────────────────────────────────────────────────
      {
        name: 'WooCommerce',
        item: [
          r('Register Merchant', 'POST', '/v1/woocommerce/merchants', {
            body: { store_url: 'https://mystore.com', store_name: 'My Store' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Validate Installation', 'POST', '/v1/woocommerce/validate-install', { body: { store_url: 'https://mystore.com' } }),
          r('Download Plugin', 'GET', '/v1/woocommerce/plugin/download'),
        ],
      },

      // ── Sandbox ─────────────────────────────────────────────────────
      {
        name: 'Sandbox',
        item: [
          r('Create Sandbox Account', 'POST', '/v1/sandbox/accounts', { headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }] }),
          r('Create Sandbox API Key', 'POST', '/v1/sandbox/api-keys', { headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }] }),
          r('Generate Test Data', 'POST', '/v1/sandbox/data/generate'),
          r('Register Sandbox Webhook', 'POST', '/v1/sandbox/webhooks', {
            body: { url: 'https://yourapp.com/sandbox-webhook', events: ['payment.completed'] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Developer ───────────────────────────────────────────────────
      {
        name: 'Developer',
        item: [
          r('Register Developer App', 'POST', '/v1/developers/register', {
            body: { app_name: 'My FinTech App', redirect_uris: ['https://app.example.com/callback'], use_case: 'payment_aggregation' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Payment Gateway ─────────────────────────────────────────────
      {
        name: 'Payment Gateway',
        item: [
          r('Create Charge', 'POST', '/v1/gateway/charges', {
            body: { merchant_id: '{{merchant_id}}', amount: 5000, currency: 'XAF', channel: 'mobile_money', customer_phone: '237677123456', tx_ref: 'order_001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Charge', 'GET', '/v1/gateway/charges/{{charge_id}}'),
          r('List Charges', 'GET', '/v1/gateway/charges', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'limit', value: '50' }] }),
          r('Verify Charge', 'POST', '/v1/gateway/charges/{{charge_id}}/verify', { desc: 'Poll provider for real-time status sync' }),
          r('Cancel Charge', 'POST', '/v1/gateway/charges/{{charge_id}}/cancel'),
          r('Fee Estimate', 'GET', '/v1/gateway/fee-estimate', { query: [{ key: 'amount', value: '5000' }, { key: 'channel', value: 'mobile_money' }, { key: 'currency', value: 'XAF' }] }),
          r('Create Refund', 'POST', '/v1/gateway/refunds', {
            body: { charge_id: '{{charge_id}}', amount: 5000, reason: 'Customer request' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Refund', 'GET', '/v1/gateway/refunds/{{refund_id}}'),
          r('List Refunds', 'GET', '/v1/gateway/refunds', { query: [{ key: 'limit', value: '50' }] }),
          r('Create Payout', 'POST', '/v1/gateway/payouts', {
            body: { merchant_id: '{{merchant_id}}', amount: 10000, currency: 'XAF', channel: 'mobile_money', beneficiary_phone: '237677123456', beneficiary_name: 'Jean Dupont', tx_ref: 'pay_001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Payout', 'GET', '/v1/gateway/payouts/{{payout_id}}'),
          r('List Payouts', 'GET', '/v1/gateway/payouts', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'limit', value: '50' }] }),
          r('Create Payout Batch', 'POST', '/v1/gateway/payout-batches', {
            body: { merchant_id: '{{merchant_id}}', currency: 'XAF', items: [{ amount: 5000, channel: 'mobile_money', beneficiary_phone: '237677111111', beneficiary_name: 'Alice' }] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Payout Batch', 'GET', '/v1/gateway/payout-batches/{{batch_id}}'),
          r('List Disputes', 'GET', '/v1/gateway/disputes', { query: [{ key: 'limit', value: '50' }] }),
          r('Get Dispute', 'GET', '/v1/gateway/disputes/{{dispute_id}}'),
          r('Submit Dispute Evidence', 'POST', '/v1/gateway/disputes/{{dispute_id}}/evidence', {
            body: { evidence_text: 'Customer received goods on 2026-02-18.', evidence_type: 'receipt' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Settlements', 'GET', '/v1/gateway/settlements', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'limit', value: '50' }] }),
          r('Get Settlement', 'GET', '/v1/gateway/settlements/{{settlement_id}}'),
          r('Create Beneficiary', 'POST', '/v1/gateway/beneficiaries', {
            body: { merchant_id: '{{merchant_id}}', name: 'Jean Dupont', channel: 'mobile_money', phone: '237677123456' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Beneficiaries', 'GET', '/v1/gateway/beneficiaries', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Delete Beneficiary', 'DELETE', '/v1/gateway/beneficiaries/{{beneficiary_id}}'),
          r('Transaction Report', 'GET', '/v1/gateway/reports/transactions', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'from', value: '2026-02-01' }, { key: 'to', value: '2026-02-28' }] }),
          r('Settlement Report', 'GET', '/v1/gateway/reports/settlements', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Export Transactions CSV', 'GET', '/v1/gateway/export/transactions', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'format', value: 'csv' }] }),
          // Payment Links
          r('Create Payment Link', 'POST', '/v1/gateway/payment-links', {
            body: { merchant_id: '{{merchant_id}}', title: 'Invoice #1234', amount: 25000, currency: 'XAF', description: 'Payment for services', redirect_url: 'https://yoursite.com/thanks', max_uses: 1 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Payment Link', 'GET', '/v1/gateway/payment-links', { query: [{ key: 'slug', value: 'pay-abc123' }], desc: 'Public – no auth required' }),
          r('List Payment Links', 'GET', '/v1/gateway/payment-links', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          // Subscriptions
          r('Create Payment Plan', 'POST', '/v1/gateway/payment-plans', {
            body: { merchant_id: '{{merchant_id}}', name: 'Premium Monthly', amount: 15000, currency: 'XAF', interval: 'monthly', interval_count: 1, duration: 12 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Create Subscription', 'POST', '/v1/gateway/subscriptions', {
            body: { merchant_id: '{{merchant_id}}', plan_id: 'PLAN_UUID', customer_email: 'john@example.com', customer_phone: '237677123456' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Cancel Subscription', 'POST', '/v1/gateway/subscriptions/cancel', {
            body: { subscription_id: 'SUB_UUID', reason: 'Customer request' },
          }),
          // Split Payments
          r('Create Subaccount', 'POST', '/v1/gateway/subaccounts', {
            body: { merchant_id: '{{merchant_id}}', subaccount_name: 'Seller A', settlement_bank: 'SGCM', account_number: '1234567890', split_type: 'percentage', split_value: 20 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Subaccounts', 'GET', '/v1/gateway/subaccounts', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          // Tokenization
          r('Create Customer', 'POST', '/v1/gateway/customers', {
            body: { merchant_id: '{{merchant_id}}', email: 'john@example.com', name: 'John Doe', phone: '+237677123456' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Charge Token', 'POST', '/v1/gateway/charges/token', {
            body: { merchant_id: '{{merchant_id}}', token_id: 'TOKEN_UUID', amount: 10000, currency: 'XAF', tx_ref: 'recurring_001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          // Charge Events
          r('Get Charge Events', 'GET', '/v1/gateway/charges/{{charge_id}}/events', { desc: 'Full lifecycle event timeline for a charge' }),
          // CRUD - Payment Links
          r('Update Payment Link', 'PUT', '/v1/gateway/payment-links/{{payment_link_id}}', {
            body: { title: 'Updated Invoice', amount: 30000, status: 'active' },
          }),
          r('Delete Payment Link', 'DELETE', '/v1/gateway/payment-links/{{payment_link_id}}'),
          // CRUD - Payment Plans
          r('Get Payment Plan', 'GET', '/v1/gateway/payment-plans/{{plan_id}}'),
          r('List Payment Plans', 'GET', '/v1/gateway/payment-plans', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Update Payment Plan', 'PUT', '/v1/gateway/payment-plans/{{plan_id}}', {
            body: { name: 'Updated Plan', status: 'inactive' },
          }),
          // CRUD - Subscriptions
          r('Get Subscription', 'GET', '/v1/gateway/subscriptions/{{subscription_id}}'),
          r('List Subscriptions', 'GET', '/v1/gateway/subscriptions', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          // CRUD - Subaccounts
          r('Get Subaccount', 'GET', '/v1/gateway/subaccounts/{{subaccount_id}}'),
          r('Update Subaccount', 'PUT', '/v1/gateway/subaccounts/{{subaccount_id}}', {
            body: { subaccount_name: 'Updated Seller', split_value: 25 },
          }),
          r('Delete Subaccount', 'DELETE', '/v1/gateway/subaccounts/{{subaccount_id}}'),
          // CRUD - Customers
          r('List Customers', 'GET', '/v1/gateway/customers', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Get Customer', 'GET', '/v1/gateway/customers/{{customer_id}}'),
          r('Update Customer', 'PUT', '/v1/gateway/customers/{{customer_id}}', {
            body: { name: 'Jane Doe', phone: '+237677999888' },
          }),
          // CRUD - Customer Tokens
          r('List Customer Tokens', 'GET', '/v1/gateway/customers/{{customer_id}}/tokens'),
          r('Revoke Customer Token', 'DELETE', '/v1/gateway/customers/{{customer_id}}/tokens/{{token_id}}'),
          // Exchange Rate
          r('Get Exchange Rate', 'GET', '/v1/gateway/exchange-rate', { query: [{ key: 'from', value: 'XAF' }, { key: 'to', value: 'USD' }, { key: 'amount', value: '100000' }] }),
          // Retry Payout
          r('Retry Failed Payout', 'POST', '/v1/gateway/payouts/{{payout_id}}/retry', {
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },
    ],
  };

  return new Response(JSON.stringify(collection, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="kang-openbanking-api-v1.postman_collection.json"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
