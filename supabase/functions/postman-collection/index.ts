import { corsHeaders } from "../_shared/cors.ts";

// Helper to create a request item
const r = (name: string, method: string, path: string, opts?: {
  body?: Record<string, unknown>;
  bodyMode?: 'raw' | 'urlencoded';
  urlencoded?: { key: string; value: string }[];
  query?: { key: string; value: string }[];
  desc?: string;
  headers?: { key: string; value: string }[];
  tests?: string[];
  saveVar?: { field: string; varName: string };
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

  // Auto-inject test scripts
  const testLines: string[] = [];
  const expectedStatus = method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200;
  testLines.push(`pm.test("Status is 2xx", function () { pm.expect(pm.response.code).to.be.within(200, 299); });`);
  if (method !== 'DELETE') {
    testLines.push(`pm.test("Body is JSON", function () { pm.response.to.be.json; });`);
  }
  if (opts?.tests) testLines.push(...opts.tests);
  if (opts?.saveVar) {
    testLines.push(`var d = pm.response.json(); if (d.${opts.saveVar.field}) { pm.collectionVariables.set('${opts.saveVar.varName}', d.${opts.saveVar.field}); }`);
  }

  item.event = [
    { listen: 'test', script: { type: 'text/javascript', exec: testLines } },
  ];

  return item;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Postman test script helpers
  const testStatus = (code: number) => `pm.test("Status is ${code}", function () { pm.response.to.have.status(${code}); });`;
  const testJson = () => `pm.test("Body is JSON", function () { pm.response.to.be.json; });`;
  const testHasField = (field: string) => `pm.test("Has '${field}' field", function () { var d = pm.response.json(); pm.expect(d).to.have.property('${field}'); });`;
  const testSaveVar = (field: string, varName: string) => `var d = pm.response.json(); if (d.${field}) { pm.collectionVariables.set('${varName}', d.${field}); }`;

  // Postman environments
  const environments = [
    {
      name: 'KOB Sandbox',
      values: [
        { key: 'base_url', value: (Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1').replace('://api.', '://sandbox-api.'), enabled: true },
        { key: 'environment', value: 'sandbox', enabled: true },
        { key: 'access_token', value: '', enabled: true },
        { key: 'client_id', value: 'YOUR_SANDBOX_CLIENT_ID', enabled: true },
        { key: 'client_secret', value: 'YOUR_SANDBOX_CLIENT_SECRET', enabled: true },
        { key: 'api_key', value: 'YOUR_SANDBOX_API_KEY', enabled: true },
        { key: 'merchant_api_key', value: '', enabled: true },
        { key: 'webhook_secret', value: '', enabled: true },
        { key: 'idempotency_key_prefix', value: 'test_', enabled: true },
      ],
    },
    {
      name: 'KOB Production',
      values: [
        { key: 'base_url', value: Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1', enabled: true },
        { key: 'environment', value: 'production', enabled: true },
        { key: 'access_token', value: '', enabled: true },
        { key: 'client_id', value: 'YOUR_PROD_CLIENT_ID', enabled: true },
        { key: 'client_secret', value: 'YOUR_PROD_CLIENT_SECRET', enabled: true },
        { key: 'api_key', value: 'YOUR_PROD_API_KEY', enabled: true },
        { key: 'merchant_api_key', value: '', enabled: true },
        { key: 'webhook_secret', value: '', enabled: true },
        { key: 'idempotency_key_prefix', value: 'live_', enabled: true },
      ],
    },
  ];

  // Pre-request script for auto-auth
  const preRequestAuth = `
// Auto-authenticate if access_token is empty or expired
if (!pm.collectionVariables.get('access_token') || pm.collectionVariables.get('access_token') === 'YOUR_ACCESS_TOKEN') {
  const clientId = pm.environment.get('client_id') || pm.collectionVariables.get('client_id');
  const clientSecret = pm.environment.get('client_secret') || pm.collectionVariables.get('client_secret');
  if (clientId && clientSecret && clientId !== 'YOUR_SANDBOX_CLIENT_ID') {
    pm.sendRequest({
      url: pm.collectionVariables.get('base_url') + '/v1/oauth/token',
      method: 'POST',
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: { mode: 'urlencoded', urlencoded: [
        { key: 'grant_type', value: 'client_credentials' },
        { key: 'client_id', value: clientId },
        { key: 'client_secret', value: clientSecret },
        { key: 'scope', value: 'accounts payments' },
      ]},
    }, function (err, res) {
      if (!err && res.code === 200) {
        var body = res.json();
        pm.collectionVariables.set('access_token', body.access_token);
      }
    });
  }
}`;

  const collection = {
    info: {
      name: 'Kang Open Banking API v1',
      description: 'Complete Postman collection for the KOB API – aligned 1:1 with the OpenAPI 3.1 spec. COBAC & BEAC compliant.\n\n## Quick Start\n1. Import this collection\n2. Import the **KOB Sandbox** environment\n3. Set your `client_id` and `client_secret`\n4. Run the "Get Token (Client Credentials)" request\n5. All subsequent requests auto-authenticate via Bearer token\n\n## Environments\nUse `GET /v1/postman-environments` to download sandbox and production environment files.',
      version: '2.0.0',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{access_token}}', type: 'string' }] },
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: preRequestAuth.split('\n') } },
    ],
    variable: [
      { key: 'base_url', value: Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1', type: 'string' },
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
      { key: 'bank_id', value: 'BANK_UUID', type: 'string' },
      { key: 'connector_id', value: 'CONNECTOR_UUID', type: 'string' },
      { key: 'intent_id', value: 'INTENT_UUID', type: 'string' },
      { key: 'client_id', value: 'YOUR_CLIENT_ID', type: 'string' },
      { key: 'client_secret', value: 'YOUR_CLIENT_SECRET', type: 'string' },
      { key: 'idempotency_key', value: '', type: 'string' },
      { key: 'webhook_url', value: 'https://yourapp.com/webhooks/kob', type: 'string' },
      { key: 'subscription_id', value: 'SUB_UUID', type: 'string' },
      { key: 'payment_link_id', value: 'PL_UUID', type: 'string' },
      { key: 'virtual_account_id', value: 'VA_UUID', type: 'string' },
      { key: 'subaccount_id', value: 'SA_UUID', type: 'string' },
      { key: 'customer_id', value: 'CUST_UUID', type: 'string' },
      { key: 'token_id', value: 'TOKEN_UUID', type: 'string' },
      { key: 'plan_id', value: 'PLAN_UUID', type: 'string' },
      { key: 'reconciliation_run_id', value: 'RECON_UUID', type: 'string' },
      { key: 'mismatch_id', value: 'MISMATCH_UUID', type: 'string' },
      { key: 'escrow_id', value: 'ESCROW_UUID', type: 'string' },
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
          r('Get Access Token (Authorization Code)', 'POST', '/v1/oauth/token', {
            bodyMode: 'urlencoded',
            urlencoded: [
              { key: 'grant_type', value: 'authorization_code' },
              { key: 'client_id', value: 'YOUR_CLIENT_ID' },
              { key: 'client_secret', value: 'YOUR_CLIENT_SECRET' },
              { key: 'code', value: 'AUTH_CODE' },
            ],
          }),
          r('Get Token (Client Credentials)', 'POST', '/v1/oauth/token', {
            bodyMode: 'urlencoded',
            urlencoded: [
              { key: 'grant_type', value: 'client_credentials' },
              { key: 'client_id', value: 'YOUR_CLIENT_ID' },
              { key: 'client_secret', value: 'YOUR_CLIENT_SECRET' },
              { key: 'scope', value: 'accounts payments' },
            ],
            desc: 'Server-to-server flow — no user context required.',
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
            // v4.29.3 — PISP submission requires full payment instruction (BoG-OBSv4 §5.2.2)
            body: {
              payment_id: '{{payment_id}}',
              consent_id: '{{consent_id}}',
              amount: '50000',
              currency: 'XAF',
              debtor_account: '10005-00001-09876543210-45',
              creditor_account: '10005-00001-12345678901-23',
            },
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
          r('Create Payment Intent (Stripe)', 'POST', '/v1/stripe/payment-intent', {
            body: { amount: 10000, currency: 'xaf' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Confirm Payment (Stripe)', 'POST', '/v1/stripe/confirm-payment', { body: { payment_intent_id: 'pi_xxx' } }),
          r('Bank Transfer (Flutterwave)', 'POST', '/v1/flutterwave/bank-transfer', {
            body: { account_number: '1234567890', bank_code: 'SGCM', amount: 50000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Banks', 'GET', '/v1/flutterwave/banks', { query: [{ key: 'country', value: 'CM' }] }),
          r('Verify Bank Account', 'POST', '/v1/flutterwave/verify-bank', { body: { account_number: '1234567890', bank_code: 'SGCM' } }),
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
          r('Internal Account Transfer', 'POST', '/v1/banking/internal-transfer', {
            body: { source_account_id: '{{account_id}}', destination_account_id: 'DEST_ACCOUNT_UUID', amount: 25000, currency: 'XAF', description: 'Internal transfer' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Transfer funds between two KOB accounts. Source must belong to authenticated user.',
          }),
          r('Facilitated Bank Transfer', 'POST', '/v1/banking/facilitated-transfer', {
            body: { account_number: '1234567890', bank_code: 'SGCM', bank_name: 'Société Générale Cameroun', amount: 100000, currency: 'XAF', narration: 'Salary payment', institution_id: '{{institution_id}}', account_name: 'Jean Dupont' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Institution-facilitated bank payout via Flutterwave with KOB fee calculation.',
          }),
          r('Facilitated Mobile Money Charge', 'POST', '/v1/banking/facilitated-mobile-money-charge', {
            body: { phone_number: '237677123456', amount: 5000, currency: 'XAF', email: 'customer@example.com', redirect_url: 'https://yoursite.com/callback', metadata: { order_id: 'ORD-12345' } },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Facilitated mobile money collection via KOB Flutterwave rail with automatic fee calculation.',
          }),
        ],
      },

      // ── Virtual Cards ───────────────────────────────────────────────
      {
        name: 'Virtual Cards',
        item: [
          r('Create Virtual Card', 'POST', '/v1/cards', {
            body: { currency: 'USD', initial_amount: 100 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Virtual Cards', 'GET', '/v1/cards'),
          r('Update Card Status', 'PUT', '/v1/cards/{{card_id}}/status', { body: { status: 'frozen' } }),
          r('Top Up Card', 'POST', '/v1/cards/{{card_id}}/topup', {
            body: { amount: 50, source_currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Card Transactions', 'GET', '/v1/cards/{{card_id}}/transactions'),
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
            body: { store_name: 'My Cameroon Store', store_url: 'https://mystore.cm', admin_email: 'admin@mystore.cm', plugin_version: '1.0.0', business_type: 'company', phone: '+237677123456', country: 'CM' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Register a WooCommerce store for Kang Open Banking payment processing',
          }),
          r('Validate Installation', 'POST', '/v1/woocommerce/validate-install', {
            body: { api_key: '{{woo_api_key}}', plugin_version: '1.0.0', store_url: 'https://mystore.cm', php_version: '8.1', wp_version: '6.4', wc_version: '8.5' },
            desc: 'Validate plugin installation and API credentials',
          }),
          r('Download Plugin', 'GET', '/v1/woocommerce/plugin/download', {
            desc: 'Download the complete Woo for Kang WordPress plugin as a ZIP file',
          }),
          r('Process Payment', 'POST', '/v1/woocommerce/process-payment', {
            body: { amount: 25000, currency: 'XAF', woocommerce_order_id: 1234, customer_email: 'customer@example.com', customer_name: 'Jean Dupont', customer_phone: '237677123456', payment_methods: ['mobile_money', 'card', 'bank_transfer'], return_url: 'https://mystore.cm/checkout/order-received/1234', webhook_url: 'https://mystore.cm/wc-api/wfk_webhook' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }, { key: 'X-API-Key', value: '{{woo_api_key}}' }],
            desc: 'Initiate a payment for a WooCommerce order',
          }),
          r('List Transactions', 'GET', '/v1/woocommerce/transactions', {
            query: [{ key: 'start_date', value: '2026-01-01' }, { key: 'end_date', value: '2026-02-26' }, { key: 'status', value: 'completed' }, { key: 'limit', value: '50' }],
            desc: 'Retrieve WooCommerce transaction history for synchronization',
          }),
          r('Payment Webhook', 'POST', '/v1/woocommerce/webhook', {
            body: { event_type: 'payment.completed', transaction_ref: 'wfk_txn_abc123', woocommerce_order_id: 1234, status: 'completed', amount: 25000, currency: 'XAF', payment_method: 'mobile_money', timestamp: '2026-02-26T12:00:00Z' },
            desc: 'Webhook endpoint for payment status notifications',
          }),
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

      // ── Merchants ─────────────────────────────────────────────────
      {
        name: 'Merchants',
        item: [
          r('Create Merchant', 'POST', '/v1/merchants', {
            body: { business_name: 'Ma Boutique Douala', business_email: 'contact@maboutique.cm', business_phone: '+237677123456' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Merchant', 'GET', '/v1/merchants', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('List Merchants', 'GET', '/v1/merchants'),
          r('Update Merchant', 'PATCH', '/v1/merchants', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }], body: { business_name: 'Updated Name' } }),
          r('Submit Merchant', 'POST', '/v1/merchants', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'action', value: 'submit' }], desc: 'DRAFT → SUBMITTED' }),
          r('Activate Merchant (Admin)', 'POST', '/v1/merchants', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'action', value: 'activate' }], desc: 'VERIFIED → ACTIVE' }),
          r('Suspend Merchant (Admin)', 'POST', '/v1/merchants', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'action', value: 'suspend' }] }),
          r('Submit KYB', 'POST', '/v1/merchants/kyb', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'action', value: 'submit' }],
            body: { registration_number: 'RC/DLA/2026/B/001', tax_id: 'TAX-CM-12345' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get KYB Status', 'GET', '/v1/merchants/kyb', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Review KYB (Admin)', 'POST', '/v1/merchants/kyb', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'action', value: 'review' }],
            body: { decision: 'approved', reason: 'All documents verified' },
          }),
          r('Issue API Key', 'POST', '/v1/merchants/api-keys', {
            body: { merchant_id: '{{merchant_id}}', environment: 'sandbox', label: 'Primary' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List API Keys', 'GET', '/v1/merchants/api-keys', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Revoke API Key', 'DELETE', '/v1/merchants/api-keys', { body: { key_id: 'KEY_UUID', merchant_id: '{{merchant_id}}' } }),
          r('Rotate API Key', 'PATCH', '/v1/merchants/api-keys', { body: { key_id: 'KEY_UUID', merchant_id: '{{merchant_id}}' } }),
          r('Add Settlement Account', 'POST', '/v1/merchants/settlement-accounts', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }],
            body: { account_type: 'mobile_money', phone_number: '237677123456', currency: 'XAF', is_default: true },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Settlement Accounts', 'GET', '/v1/merchants/settlement-accounts', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Register Webhook', 'POST', '/v1/merchants/webhooks', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }],
            body: { url: 'https://yourapp.com/webhooks/kob', events: ['charge.successful', 'payout.completed'], label: 'Production' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Webhooks', 'GET', '/v1/merchants/webhooks', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Test Webhook Ping', 'POST', '/v1/merchants/webhooks', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'webhook_id', value: 'WH_UUID' }, { key: 'action', value: 'test' }],
          }),
          r('Webhook Deliveries', 'GET', '/v1/merchants/webhooks', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'webhook_id', value: 'WH_UUID' }, { key: 'action', value: 'deliveries' }],
          }),
        ],
      },

      // ── Reconciliation ──────────────────────────────────────────────
      {
        name: 'Reconciliation',
        item: [
          r('Run Reconciliation', 'POST', '/v1/gateway/reconciliation', {
            body: { merchant_id: '{{merchant_id}}', provider: 'flutterwave', period_start: '2026-02-01T00:00:00Z', period_end: '2026-02-28T23:59:59Z' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Reconciliation Runs', 'GET', '/v1/gateway/reconciliation'),
          r('Get Run Mismatches', 'GET', '/v1/gateway/reconciliation/{{reconciliation_run_id}}/mismatches', {
            query: [{ key: 'limit', value: '50' }],
            desc: 'Retrieve mismatches for a completed reconciliation run.',
          }),
          r('Resolve Mismatch', 'POST', '/v1/gateway/reconciliation/{{reconciliation_run_id}}/mismatches/{{mismatch_id}}/resolve', {
            body: { resolution: 'accepted', resolution_notes: 'Verified with provider statement' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Mark a reconciliation mismatch as resolved.',
          }),
          r('Fee Report', 'GET', '/v1/gateway/reports/fees', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'from', value: '2026-02-01' }, { key: 'to', value: '2026-02-28' }],
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
            saveVar: { field: 'id', varName: 'charge_id' },
            tests: [`pm.test("Has charge id", function () { pm.expect(pm.response.json()).to.have.property('id'); });`],
          }),
          r('Get Charge', 'GET', '/v1/gateway/charges/{{charge_id}}'),
          r('List Charges', 'GET', '/v1/gateway/charges', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }, { key: 'limit', value: '50' }] }),
          r('Verify Charge', 'POST', '/v1/gateway/charges/{{charge_id}}/verify', { desc: 'Poll provider for real-time status sync' }),
          r('Cancel Charge', 'POST', '/v1/gateway/charges/{{charge_id}}/cancel'),
          r('Fee Estimate', 'GET', '/v1/gateway/fee-estimate', { query: [{ key: 'amount', value: '5000' }, { key: 'channel', value: 'mobile_money' }, { key: 'currency', value: 'XAF' }] }),
          r('Create Refund', 'POST', '/v1/gateway/refunds', {
            body: { charge_id: '{{charge_id}}', amount: 5000, reason: 'Customer request' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            saveVar: { field: 'id', varName: 'refund_id' },
          }),
          r('Get Refund', 'GET', '/v1/gateway/refunds/{{refund_id}}'),
          r('List Refunds', 'GET', '/v1/gateway/refunds', { query: [{ key: 'limit', value: '50' }] }),
          r('Create Payout', 'POST', '/v1/gateway/payouts', {
            body: { merchant_id: '{{merchant_id}}', amount: 10000, currency: 'XAF', channel: 'mobile_money', beneficiary_phone: '237677123456', beneficiary_name: 'Jean Dupont', tx_ref: 'pay_001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            saveVar: { field: 'id', varName: 'payout_id' },
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
          // Preauthorization
          r('Preauthorize Charge', 'POST', '/v1/gateway/charges/preauth', {
            body: { merchant_id: '{{merchant_id}}', amount: 50000, currency: 'USD', customer_email: 'john@example.com', tx_ref: 'preauth_001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Hold funds on a card without capturing',
          }),
          r('Capture Charge', 'POST', '/v1/gateway/charges/{{charge_id}}/capture', {
            body: { amount: 50000 },
            desc: 'Capture a preauthorized charge (full or partial)',
          }),
          r('Void Charge', 'POST', '/v1/gateway/charges/{{charge_id}}/void', {
            body: { charge_id: '{{charge_id}}' },
            desc: 'Release an authorized hold',
          }),
          // OTP Validation
          r('Validate Charge (OTP)', 'POST', '/v1/gateway/charges/validate', {
            body: { charge_id: '{{charge_id}}', otp: '123456' },
            desc: 'Submit OTP to complete a pending charge',
          }),
          // Virtual Accounts
          r('Create Virtual Account', 'POST', '/v1/gateway/virtual-accounts', {
            body: { merchant_id: '{{merchant_id}}', email: 'merchant@example.com', currency: 'NGN', is_permanent: false },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Virtual Accounts', 'GET', '/v1/gateway/virtual-accounts', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          r('Get Virtual Account', 'GET', '/v1/gateway/virtual-accounts/{{virtual_account_id}}'),
          // Merchant Balances
          r('Get Merchant Balances', 'GET', '/v1/gateway/balances', { query: [{ key: 'merchant_id', value: '{{merchant_id}}' }] }),
          // KYC Verification
          r('Verify Bank Account', 'POST', '/v1/gateway/verify-bank-account', {
            body: { account_number: '1234567890', account_bank: '044' },
            desc: 'Resolve bank account holder name',
          }),
          r('Resolve BVN', 'POST', '/v1/gateway/resolve-bvn', {
            body: { bvn: '12345678901' },
            desc: 'Resolve BVN to identity details',
          }),
          // Account Funding & Withdrawal
          r('Fund Account (Mobile Money)', 'POST', '/v1/gateway/fund-account', {
            body: { amount: 50000, currency: 'XAF', channel: 'mobile_money', account_id: '{{account_id}}', source_phone: '237677123456' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Add funds to a KOB account via Mobile Money',
          }),
          r('Fund Account (Card)', 'POST', '/v1/gateway/fund-account', {
            body: { amount: 100000, currency: 'XAF', channel: 'card', account_id: '{{account_id}}', source_email: 'john@example.com' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Add funds to a KOB account via Card (Stripe)',
          }),
          r('Withdraw to External Bank', 'POST', '/v1/gateway/withdraw-to-bank', {
            body: { amount: 25000, account_id: '{{account_id}}', bank_code: 'SGCM', account_number: '1234567890', beneficiary_name: 'Jean Dupont', narration: 'Salary withdrawal' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
           desc: 'Withdraw from KOB account to external bank',
          }),
          // Risk Scoring
          r('Score Transaction Risk', 'POST', '/v1/gateway/risk/score', {
            body: { merchant_id: '{{merchant_id}}', amount: 500000, currency: 'XAF', channel: 'mobile_money', customer_phone: '237677123456', customer_ip: '197.239.5.1' },
            desc: 'Run velocity, amount, and pattern anomaly risk checks on a proposed transaction',
          }),
          // Gateway Exchange Rate
          r('Get Gateway Exchange Rate', 'GET', '/v1/gateway/exchange-rate', {
            query: [{ key: 'from', value: 'XAF' }, { key: 'to', value: 'USD' }, { key: 'amount', value: '100000' }],
            desc: 'Real-time FX rate lookup for multi-currency charges and settlements',
          }),
          // PayPal Integration
          r('Create PayPal Payout', 'POST', '/v1/gateway/payouts/paypal', {
            body: { merchant_id: '{{merchant_id}}', amount: 5000, currency: 'USD', recipient_type: 'EMAIL', receiver: 'recipient@example.com', note: 'Invoice payment', tx_ref: 'paypal_pay_001' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Send money to a PayPal recipient (EMAIL, PHONE, or PAYPAL_ID)',
          }),
          r('Get PayPal Payout Status', 'GET', '/v1/gateway/payouts/{{payout_id}}', {
            desc: 'Poll PayPal payout batch/item status',
          }),
          r('Withdraw to PayPal', 'POST', '/v1/gateway/withdraw-to-paypal', {
            body: { amount: 10000, account_id: '{{account_id}}', paypal_email: 'user@example.com', currency: 'USD', narration: 'Balance withdrawal' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Withdraw KOB account balance to a PayPal email',
          }),
        ],
      },

      // ── Standards & Directory ───────────────────────────────────────
      {
        name: 'Standards & Directory',
        item: [
          r('Validate IBAN', 'POST', '/v1/standards/validate/iban', {
            body: { iban: 'CM21 10005 00100 01234567890 23' },
            desc: 'Validate an IBAN with MOD-97 checksum',
          }),
          r('Validate BIC/SWIFT', 'POST', '/v1/standards/validate/bic', {
            body: { bic: 'AFRIACMCXXX' },
            desc: 'Validate a BIC/SWIFT code structure',
          }),
          r('Validate Cameroon RIB', 'POST', '/v1/standards/validate/rib', {
            body: { rib: '10005001000123456789023', country: 'CM' },
            desc: 'Validate a 23-digit Cameroon domestic RIB with MOD-97 key check, returns structured fields and derived IBAN',
          }),
          r('Validate Account Identifier', 'POST', '/v1/standards/validate/account-identifier', {
            body: { type: 'DOMESTIC_RIB', value: '10005001000123456789023', country: 'CM' },
            desc: 'Unified validator for DOMESTIC_RIB, IBAN, LOCAL_BANK, or MOMO with automatic rail determination',
          }),
          r('Cameroon Bank Directory', 'GET', '/v1/directory/banks/cm', {
            desc: 'Static catalog of Cameroon banks with 5-digit codes, SWIFT BICs, and RIB support flags',
          }),
        ],
      },

      // ── OAuth Extensions ────────────────────────────────────────────
      {
        name: 'OAuth Extensions',
        item: [
          r('Revoke Token', 'POST', '/v1/oauth/revoke', {
            bodyMode: 'urlencoded',
            urlencoded: [
              { key: 'token', value: '{{access_token}}' },
              { key: 'token_type_hint', value: 'access_token' },
              { key: 'client_id', value: 'YOUR_CLIENT_ID' },
              { key: 'client_secret', value: 'YOUR_CLIENT_SECRET' },
            ],
            desc: 'Revoke an access or refresh token (RFC 7009)',
          }),
          r('UserInfo', 'GET', '/v1/oauth/userinfo', {
            desc: 'OpenID Connect UserInfo endpoint — returns claims for the authenticated user',
          }),
        ],
      },

      // ── Consumer Tools ──────────────────────────────────────────────
      {
        name: 'Consumer Tools',
        item: [
          r('Create Piggy Bank', 'POST', '/v1/consumer/piggybank', {
            body: { name: 'Emergency Fund', target_amount: 500000, currency: 'XAF', frequency: 'monthly', contribution_amount: 25000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Create a personal savings goal (Piggy Bank)',
          }),
          r('Pay Piggy Bank', 'POST', '/v1/consumer/piggybank/pay', {
            body: { piggybank_id: 'PIGGYBANK_UUID', amount: 25000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Contribute to a savings goal. Impacts credit score positively.',
          }),
          r('Create Njangi Group', 'POST', '/v1/consumer/njangi', {
            body: { name: 'Office Njangi', contribution_amount: 25000, currency: 'XAF', frequency: 'monthly', max_members: 10, payout_method: 'random' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Create a rotating savings circle (tontine)',
          }),
          r('Join Njangi Group', 'POST', '/v1/consumer/njangi/join', {
            body: { group_id: 'GROUP_UUID' },
          }),
          r('Njangi Contribution', 'POST', '/v1/consumer/njangi/contribute', {
            body: { group_id: 'GROUP_UUID', amount: 25000 },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Submit a contribution to the group pot',
          }),
          r('Njangi Payout', 'POST', '/v1/consumer/njangi/payout', {
            body: { group_id: 'GROUP_UUID' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Disburse the accumulated pot to the next eligible member',
          }),
        ],
      },

      // ── Funding Intents ─────────────────────────────────────────────
      {
        name: 'Funding Intents',
        item: [
          r('Create Funding Intent', 'POST', '/v1/gateway/funding-intents', {
            body: { amount: 50000, currency: 'XAF', source: 'stripe' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Funding Intents', 'GET', '/v1/gateway/funding-intents', {
            query: [{ key: 'status', value: 'pending' }],
          }),
          r('Get Funding Intent', 'GET', '/v1/gateway/funding-intents/{{funding_intent_id}}'),
          r('Cancel Funding Intent', 'POST', '/v1/gateway/funding-intents/{{funding_intent_id}}/cancel'),
          r('Confirm Funding Intent', 'POST', '/v1/gateway/funding-intents/{{funding_intent_id}}/confirm'),
        ],
      },

      // ── Teller Operations ───────────────────────────────────────────
      {
        name: 'Teller Operations',
        item: [
          r('Teller Transaction', 'POST', '/v1/teller/transaction', {
            body: { account_id: '{{account_id}}', amount: 100000, transaction_type: 'deposit', narration: 'Cash deposit at branch', branch_id: '{{branch_id}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Process a cash deposit or withdrawal at a bank branch',
          }),
        ],
      },

      // ── Wallets ─────────────────────────────────────────────────────
      {
        name: 'Wallets',
        item: [
          r('Get Merchant Wallet', 'GET', '/v1/gateway/wallets', {
            desc: 'Get merchant wallet balances (available, pending, ledger)',
          }),
          r('Get Wallet Balance', 'GET', '/v1/gateway/wallets/balance', {
            query: [{ key: 'currency', value: 'XAF' }],
          }),
          r('Wallet Transactions', 'GET', '/v1/gateway/wallets/transactions', {
            query: [{ key: 'limit', value: '25' }, { key: 'offset', value: '0' }],
          }),
        ],
      },

      // ── Escrow ──────────────────────────────────────────────────────
      {
        name: 'Escrow',
        item: [
          r('Create Escrow', 'POST', '/v1/gateway/escrow', {
            body: { amount: 100000, currency: 'XAF', beneficiary_id: '{{beneficiary_id}}', release_conditions: 'delivery_confirmed' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Create an escrow hold for a transaction',
          }),
          r('Release Escrow', 'POST', '/v1/gateway/escrow/release', {
            body: { escrow_id: 'ESCROW_UUID' },
          }),
          r('Cancel Escrow', 'POST', '/v1/gateway/escrow/cancel', {
            body: { escrow_id: 'ESCROW_UUID', reason: 'Buyer cancelled' },
          }),
          r('Get Escrow', 'GET', '/v1/gateway/escrow/{{escrow_id}}'),
        ],
      },

      // ── Instant Payouts ─────────────────────────────────────────────
      {
        name: 'Instant Payouts',
        item: [
          r('Create Instant Payout', 'POST', '/v1/gateway/instant-payouts', {
            body: { amount: 50000, currency: 'XAF', destination: { type: 'mobile_money', phone: '237650000000' } },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Instant payout to MoMo or bank account',
          }),
          r('Push to Card', 'POST', '/v1/gateway/push-to-card', {
            body: { amount: 25000, currency: 'XAF', card_token: 'tok_xxxx' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Push funds directly to a debit card',
          }),
        ],
      },

      // ── Treasury ────────────────────────────────────────────────────
      {
        name: 'Treasury',
        item: [
          r('Get Treasury Summary', 'GET', '/v1/gateway/treasury/summary', {
            desc: 'Aggregated treasury position across all currencies',
          }),
          r('Get Treasury Movements', 'GET', '/v1/gateway/treasury/movements', {
            query: [{ key: 'from', value: '2026-01-01' }, { key: 'to', value: '2026-03-15' }],
          }),
          r('Safeguarding Ledger', 'GET', '/v1/gateway/safeguarding-ledger', {
            desc: 'Client money safeguarding report',
          }),
        ],
      },

      // ── Compliance Screening ────────────────────────────────────────
      {
        name: 'Compliance Screening',
        item: [
          r('Screen Entity', 'POST', '/v1/gateway/compliance/screen', {
            body: { name: 'Jean Kamga', country: 'CM', type: 'individual' },
            desc: 'AML/CFT sanctions and PEP screening',
          }),
          r('Submit SAR', 'POST', '/v1/gateway/sar', {
            body: { transaction_id: '{{charge_id}}', reason: 'Unusual transaction pattern', severity: 'high' },
            desc: 'Submit a Suspicious Activity Report',
          }),
        ],
      },

      // ── SLA Monitoring ──────────────────────────────────────────────
      {
        name: 'SLA Monitoring',
        item: [
          r('Get SLA Metrics', 'GET', '/v1/gateway/sla/metrics', {
            desc: 'Platform SLA compliance metrics (uptime, latency, error rates)',
          }),
          r('Get SLA Report', 'GET', '/v1/gateway/sla/report', {
            query: [{ key: 'period', value: 'monthly' }],
          }),
        ],
      },

      // ── POS & Commerce ──────────────────────────────────────────────
      {
        name: 'POS & Commerce',
        item: [
          r('List Products', 'GET', '/v1/pos/products', {
            query: [{ key: 'merchant_id', value: '{{merchant_id}}' }],
          }),
          r('Create Product', 'POST', '/v1/pos/products', {
            body: { name: 'Café Latte', price: 2500, currency: 'XAF', category: 'beverages' },
          }),
          r('Create QR Payment', 'POST', '/v1/pos/qr-payment', {
            body: { merchant_id: '{{merchant_id}}', amount: 5000, currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Browse Stores', 'GET', '/v1/pos/stores', {
            desc: 'Browse published marketplace stores',
          }),
          r('Submit Order', 'POST', '/v1/pos/orders', {
            body: { merchant_id: '{{merchant_id}}', items: [{ product_id: 'PRODUCT_UUID', quantity: 2 }] },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
        ],
      },

      // ── Bank Directory ──────────────────────────────────────────────
      {
        name: 'Bank Directory',
        item: [
          r('List Directory (Public)', 'GET', '/v1/directory/banks', {
            desc: 'Public list of active banks integrated with KOB',
          }),
          r('Register Bank', 'POST', '/v1/banks/register', {
            body: { legal_name: 'Afriland First Bank', short_code: 'AFB', swift_bic: 'AFRIACMCXXX', contact_email: 'api@afriland.com', integration_mode: 'connector_push' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Banks (Admin)', 'GET', '/v1/banks', { desc: 'Admin-only list of all banks' }),
          r('Get Bank', 'GET', '/v1/banks/{{bank_id}}'),
          r('Update Bank', 'PUT', '/v1/banks/{{bank_id}}', {
            body: { display_name: 'Afriland First Bank Cameroon', support_phone: '+237222000000' },
          }),
          r('Approve Bank', 'POST', '/v1/banks/{{bank_id}}/approve', { desc: 'Admin approves bank registration' }),
          r('Suspend Bank', 'POST', '/v1/banks/{{bank_id}}/suspend', { desc: 'Admin suspends bank' }),
          r('Link PSU to Bank', 'POST', '/v1/banks/{{bank_id}}/link', {
            body: { external_customer_id: 'CUST-001' },
            desc: 'Link a user to a bank for AISP/PISP access',
          }),
        ],
      },

      // ── Bank Connectors ─────────────────────────────────────────────
      {
        name: 'Bank Connectors',
        item: [
          r('Register Connector', 'POST', '/v1/banks/{{bank_id}}/connectors', {
            body: { name: 'Afriland REST Connector', environment: 'sandbox', base_url: 'https://api.afriland.cm/v1', connector_type: 'rest' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('List Connectors', 'GET', '/v1/banks/{{bank_id}}/connectors'),
          r('Connector Health', 'GET', '/v1/banks/{{bank_id}}/connectors/{{connector_id}}/health'),
          r('Upload mTLS Certificate', 'POST', '/v1/banks/{{bank_id}}/connectors/{{connector_id}}/certificates', {
            body: { certificate_pem: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----' },
          }),
          r('Ingest Accounts (Push)', 'POST', '/v1/internal/connectors/{{bank_id}}/accounts', {
            body: { accounts: [{ external_account_id: 'ACC-001', account_type: 'checking', currency: 'XAF' }], correlation_id: '{{$guid}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Bulk ingest accounts from bank connector (mTLS required)',
          }),
          r('Ingest Transactions (Push)', 'POST', '/v1/internal/connectors/{{bank_id}}/transactions', {
            body: { transactions: [{ external_tx_id: 'TX-001', account_id: 'ACC-001', amount: 50000, currency: 'XAF', credit_debit: 'credit', booking_date: '2026-03-20' }], correlation_id: '{{$guid}}' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
            desc: 'Bulk ingest transactions from bank connector (mTLS required)',
          }),
          r('Payment Status Callback', 'POST', '/v1/internal/connectors/{{bank_id}}/payments/status', {
            body: { payment_id: '{{payment_id}}', status: 'completed', details: {} },
            desc: 'Bank connector pushes payment status update',
          }),
        ],
      },

      // ── Interbank Engine ────────────────────────────────────────────
      {
        name: 'Interbank Engine',
        item: [
          r('List Interbank Payments', 'GET', '/v1/interbank/payments', {
            query: [{ key: 'status', value: 'submitted' }],
          }),
          r('Create Interbank Payment', 'POST', '/v1/interbank/payments', {
            body: { debtor_participant_id: 'PARTICIPANT_UUID', creditor_participant_id: 'PARTICIPANT_UUID', debtor_account_ref: 'ACC-001', creditor_account_ref: 'ACC-002', amount: 500000, currency: 'XAF' },
            headers: [{ key: 'Idempotency-Key', value: '{{$guid}}' }],
          }),
          r('Get Interbank Payment', 'GET', '/v1/interbank/payments/{{payment_id}}'),
          r('Submit Interbank Payment', 'POST', '/v1/interbank/payments/{{payment_id}}/submit', {
            desc: 'Generates pacs.008 and dispatches to creditor bank',
          }),
          r('List Participants', 'GET', '/v1/interbank/participants'),
          r('List ISO Messages', 'GET', '/v1/interbank/messages', {
            query: [{ key: 'payment_id', value: '{{payment_id}}' }],
          }),
        ],
      },

      // ── Pay by Bank ─────────────────────────────────────────────────
      {
        name: 'Pay by Bank',
        item: [
          r('Create Payment Intent', 'POST', '/v1/pay-by-bank/intents', {
            body: { merchant_id: '{{merchant_id}}', amount: 50000, currency: 'XAF', redirect_uri: 'https://yoursite.com/callback', state: 'order_123', description: 'Order #123' },
            desc: 'Create a redirect-based Pay by Bank payment intent with SCA',
          }),
          r('Get Payment Intent', 'POST', '/v1/pay-by-bank/intents/{{intent_id}}', {
            desc: 'Get the current status of a payment intent',
          }),
          r('List Payment Intents', 'GET', '/v1/pay-by-bank/intents', {
            query: [{ key: 'status', value: 'completed' }],
            desc: 'List all payment intents for the authenticated merchant',
          }),
          r('Authorize Intent', 'POST', '/v1/pay-by-bank/intents/{{intent_id}}/authorize', {
            body: { debtor_account: 'CM21 10003 00100 0123456789 023' },
            desc: 'User authorizes the payment (SCA)',
          }),
          r('Reject Intent', 'POST', '/v1/pay-by-bank/intents/{{intent_id}}/reject', {
            desc: 'User rejects the payment',
          }),
          r('Bank Connector Callback', 'POST', '/v1/pay-by-bank/callback', {
            body: { intent_id: '{{intent_id}}', status: 'completed' },
            desc: 'Internal callback from bank connector confirming payment execution',
          }),
        ],
      },

      // ── Smoke Test (E2E Chained Flow) ───────────────────────────────
      {
        name: 'Smoke Test (E2E)',
        description: 'Chained sequence: health → auth → create charge → verify → refund → verify refund. Run in order.',
        item: [
          r('1. Health Check', 'GET', '/v1/health', {
            tests: [`pm.test("API is healthy", function () { pm.response.to.have.status(200); });`],
          }),
          r('2. Get Auth Token', 'POST', '/v1/oauth/token', {
            bodyMode: 'urlencoded',
            urlencoded: [
              { key: 'grant_type', value: 'client_credentials' },
              { key: 'client_id', value: '{{client_id}}' },
              { key: 'client_secret', value: '{{client_secret}}' },
              { key: 'scope', value: 'accounts payments' },
            ],
            tests: [
              `pm.test("Got access_token", function () { var d = pm.response.json(); pm.expect(d).to.have.property('access_token'); pm.collectionVariables.set('access_token', d.access_token); });`,
            ],
          }),
          r('3. Create Charge', 'POST', '/v1/gateway/charges', {
            body: { merchant_id: '{{merchant_id}}', amount: 1000, currency: 'XAF', channel: 'mobile_money', customer_phone: '237650000000', tx_ref: 'smoke_{{$timestamp}}' },
            headers: [{ key: 'Idempotency-Key', value: 'smoke_charge_{{$timestamp}}' }],
            saveVar: { field: 'id', varName: 'charge_id' },
            tests: [`pm.test("Charge created with id", function () { pm.expect(pm.response.json()).to.have.property('id'); });`],
          }),
          r('4. Get Charge', 'GET', '/v1/gateway/charges/{{charge_id}}', {
            tests: [`pm.test("Charge retrieved", function () { pm.expect(pm.response.json().id).to.eql(pm.collectionVariables.get('charge_id')); });`],
          }),
          r('5. Create Refund', 'POST', '/v1/gateway/refunds', {
            body: { charge_id: '{{charge_id}}', amount: 1000, reason: 'Smoke test refund' },
            headers: [{ key: 'Idempotency-Key', value: 'smoke_refund_{{$timestamp}}' }],
            saveVar: { field: 'id', varName: 'refund_id' },
            tests: [`pm.test("Refund created", function () { pm.expect(pm.response.json()).to.have.property('id'); });`],
          }),
          r('6. Get Refund', 'GET', '/v1/gateway/refunds/{{refund_id}}', {
            tests: [`pm.test("Refund retrieved", function () { pm.expect(pm.response.json().id).to.eql(pm.collectionVariables.get('refund_id')); });`],
          }),
        ],
      },
    ],
  };

  // Check if environments were requested
  const url = new URL(req.url);
  if (url.pathname.endsWith('/postman-environments') || url.searchParams.get('type') === 'environments') {
    return new Response(JSON.stringify({ environments }, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

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
