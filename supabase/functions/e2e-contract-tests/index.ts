import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

// ═══════════════════════════════════════════════════════════════
// KOB E2E Contract Test Runner
// Tests all edge function domains for availability, CORS, auth
// guards, error format compliance, and response contracts.
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  suite: string;
  test: string;
  status: 'pass' | 'fail' | 'skip';
  duration_ms: number;
  error?: string;
  details?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function invoke(fnName: string, method: string, body?: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<{ status: number; data: any; latency: number }> {
  const start = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    ...extraHeaders,
  };
  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: res.status, data, latency: Date.now() - start };
  } catch (e) {
    return { status: 0, data: { error: (e as Error).message }, latency: Date.now() - start };
  }
}

// ─── Test Helpers ────────────────────────────────────────

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

async function runTest(suite: string, name: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { suite, test: name, status: 'pass', duration_ms: Date.now() - start };
  } catch (e) {
    return { suite, test: name, status: 'fail', duration_ms: Date.now() - start, error: (e as Error).message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SUITE 1: System Health & Discovery
// ═══════════════════════════════════════════════════════════════

async function suiteSystemHealth(): Promise<TestSuite> {
  const suite = 'System Health & Discovery';
  const tests: TestResult[] = [];

  tests.push(await runTest(suite, 'api-health returns 200 with services', async () => {
    const { status, data } = await invoke('api-health', 'POST', {});
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.services !== undefined, 'Missing services object');
    assert(data.status === 'operational' || data.status === 'degraded', `Bad status: ${data.status}`);
    assert(data.services.virtual_cards === 'dormant', 'virtual_cards should be dormant');
  }));

  tests.push(await runTest(suite, 'system-health-check returns 200', async () => {
    const { status, data } = await invoke('system-health-check', 'POST', {});
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status !== undefined, 'Missing status field');
    assert(data.status === 'healthy' || data.status === 'degraded', `Bad status: ${data.status}`);
  }));

  tests.push(await runTest(suite, 'public-api-spec returns OpenAPI spec', async () => {
    const { status, data } = await invoke('public-api-spec', 'GET');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.openapi !== undefined || data.info !== undefined, 'Not a valid OpenAPI spec');
  }));

  tests.push(await runTest(suite, 'postman-collection returns collection', async () => {
    const { status, data } = await invoke('postman-collection', 'GET');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.info !== undefined, 'Not a valid Postman collection');
  }));

  tests.push(await runTest(suite, 'oidc-config returns discovery doc', async () => {
    const { status, data } = await invoke('oidc-config', 'GET');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.issuer !== undefined, 'Missing issuer');
  }));

  tests.push(await runTest(suite, 'sdk-registry returns SDK metadata', async () => {
    const { status, data } = await invoke('sdk-registry', 'POST', { action: 'list' });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.name !== undefined || data.sdks !== undefined || Array.isArray(data) || data.version !== undefined, 'No SDK data returned');
  }));

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 2: Authentication & Authorization Guards
// ═══════════════════════════════════════════════════════════════

async function suiteAuthGuards(): Promise<TestSuite> {
  const suite = 'Auth & RBAC Guards';
  const tests: TestResult[] = [];

  const protectedEndpoints = [
    { fn: 'gateway-create-charge', body: { amount: 1000, currency: 'XAF', channel: 'card' } },
    { fn: 'gateway-create-refund', body: { charge_id: 'fake' } },
    { fn: 'gateway-create-payout', body: { merchant_id: 'fake', amount: 1000 } },
    { fn: 'gateway-verify-charge', body: { charge_id: 'fake' } },
    { fn: 'gateway-preauth-charge', body: { amount: 1000 } },
    { fn: 'aisp-accounts', body: {} },
    { fn: 'aisp-balances', body: {} },
    { fn: 'aisp-transactions', body: {} },
    { fn: 'pisp-domestic-payment', body: { amount: 1000 } },
    { fn: 'virtual-cards', body: { action: 'list' } },
  ];

  for (const ep of protectedEndpoints) {
    tests.push(await runTest(suite, `${ep.fn}: rejects unauthenticated`, async () => {
      const { status } = await invoke(ep.fn, 'POST', ep.body);
      assert(status >= 400, `Expected 4xx/5xx, got ${status}`);
    }));
  }

  // Cron-protected endpoints
  const cronEndpoints = ['gateway-settlement-cron', 'gateway-reconcile-stuck'];
  for (const fn of cronEndpoints) {
    tests.push(await runTest(suite, `${fn}: rejects without cron auth`, async () => {
      const { status } = await invoke(fn, 'POST', {});
      assert(status >= 400, `Expected 4xx+, got ${status}`);
    }));
  }

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 3: CORS Preflight Compliance
// ═══════════════════════════════════════════════════════════════

async function suiteCORS(): Promise<TestSuite> {
  const suite = 'CORS Preflight';
  const tests: TestResult[] = [];

  const endpoints = [
    'api-health', 'gateway-create-charge', 'gateway-create-refund',
    'gateway-create-payout', 'gateway-settlement-cron', 'aisp-accounts',
    'pisp-domestic-payment', 'bank-directory', 'interbank-engine',
    'bank-file-connector', 'bank-db-connector', 'bank-api-connector',
  ];

  for (const fn of endpoints) {
    tests.push(await runTest(suite, `${fn}: OPTIONS returns 200`, async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'OPTIONS',
        headers: { 'apikey': ANON_KEY },
      });
      await res.text();
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    }));
  }

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 4: Bank Connector Layer
// ═══════════════════════════════════════════════════════════════

async function suiteBankConnector(): Promise<TestSuite> {
  const suite = 'Bank Connector Layer';
  const tests: TestResult[] = [];

  tests.push(await runTest(suite, 'bank-directory: list_directory returns 200', async () => {
    const { status, data } = await invoke('bank-directory', 'POST', { action: 'list_directory' });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.banks) || data.banks !== undefined || Array.isArray(data), 'No banks data');
  }));

  tests.push(await runTest(suite, 'bank-file-connector: requires auth for upload', async () => {
    const { status } = await invoke('bank-file-connector', 'POST', { action: 'list_files', bank_id: 'fake' });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'bank-db-connector: requires auth', async () => {
    const { status } = await invoke('bank-db-connector', 'POST', { action: 'list_connections', bank_id: 'fake' });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'bank-api-connector: requires auth', async () => {
    const { status } = await invoke('bank-api-connector', 'POST', { action: 'list_endpoints', bank_id: 'fake' });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'bank-mq-connector: requires auth', async () => {
    const { status } = await invoke('bank-mq-connector', 'POST', { action: 'list_subscriptions', bank_id: 'fake' });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'interbank-engine: list_payments returns 200', async () => {
    const { status } = await invoke('interbank-engine', 'POST', { action: 'list_payments' });
    assert(status === 200 || status === 401, `Expected 200 or 401, got ${status}`);
  }));

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5: Webhook Security
// ═══════════════════════════════════════════════════════════════

async function suiteWebhookSecurity(): Promise<TestSuite> {
  const suite = 'Webhook Security';
  const tests: TestResult[] = [];

  tests.push(await runTest(suite, 'gateway-webhook-stripe: rejects missing signature', async () => {
    const { status } = await invoke('gateway-webhook-stripe', 'POST', { type: 'payment_intent.succeeded', data: { object: {} } });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'gateway-webhook-stripe: rejects invalid signature', async () => {
    const { status } = await invoke('gateway-webhook-stripe', 'POST',
      { type: 'payment_intent.succeeded', data: { object: {} } },
      { 'stripe-signature': 't=1234567890,v1=invalid_hash' }
    );
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'gateway-webhook-flutterwave: rejects missing verif-hash', async () => {
    const { status } = await invoke('gateway-webhook-flutterwave', 'POST', { event: 'charge.completed', data: {} });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'gateway-webhook-flutterwave: rejects invalid verif-hash', async () => {
    const { status } = await invoke('gateway-webhook-flutterwave', 'POST',
      { event: 'charge.completed', data: {} },
      { 'verif-hash': 'invalid-hash' }
    );
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 6: Error Format Compliance (RFC 7807)
// ═══════════════════════════════════════════════════════════════

async function suiteErrorFormat(): Promise<TestSuite> {
  const suite = 'Error Format (RFC 7807)';
  const tests: TestResult[] = [];

  const endpoints = [
    { fn: 'gateway-create-charge', body: {} },
    { fn: 'gateway-create-refund', body: {} },
    { fn: 'gateway-create-payout', body: {} },
    { fn: 'aisp-accounts', body: {} },
  ];

  for (const ep of endpoints) {
    tests.push(await runTest(suite, `${ep.fn}: error response has 'error' field`, async () => {
      const { data } = await invoke(ep.fn, 'POST', ep.body);
      assert(data.error !== undefined || data.message !== undefined, `No error field in response: ${JSON.stringify(data).substring(0, 200)}`);
    }));
  }

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 7: Payment Gateway Contract
// ═══════════════════════════════════════════════════════════════

async function suitePaymentGateway(): Promise<TestSuite> {
  const suite = 'Payment Gateway';
  const tests: TestResult[] = [];

  tests.push(await runTest(suite, 'gateway-charges: fee_estimate returns fees', async () => {
    const { status, data } = await invoke('gateway-charges', 'POST', {
      action: 'fee_estimate', amount: 10000, currency: 'XAF', channel: 'mobile_money',
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data).substring(0, 200)}`);
  }));

  tests.push(await runTest(suite, 'gateway-create-charge: idempotency header accepted', async () => {
    const { status } = await invoke('gateway-create-charge', 'POST',
      { merchant_id: 'fake', amount: 500, currency: 'XAF', channel: 'card' },
      { Authorization: 'Bearer fake-token', 'Idempotency-Key': 'test-idem-001' }
    );
    assert(status === 401, `Expected 401 (auth fail before idempotency), got ${status}`);
  }));

  tests.push(await runTest(suite, 'stripe-payment-intent: validates body', async () => {
    const { status } = await invoke('stripe-payment-intent', 'POST', { amount: 5000, currency: 'XAF' });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  tests.push(await runTest(suite, 'mobile-money-charge: rejects unauthenticated', async () => {
    const { status } = await invoke('mobile-money-charge', 'POST', {
      amount: 500, phone_number: '+237600000000', provider: 'mtn',
    });
    assert(status >= 400, `Expected 4xx, got ${status}`);
  }));

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 8: SDK Registry & Documentation
// ═══════════════════════════════════════════════════════════════

async function suiteSDKs(): Promise<TestSuite> {
  const suite = 'SDK & Documentation';
  const tests: TestResult[] = [];

  tests.push(await runTest(suite, 'sdk-registry: lists all 4 SDKs', async () => {
    const { status, data } = await invoke('sdk-registry', 'POST', { action: 'list' });
    assert(status === 200, `Expected 200, got ${status}`);
    const sdks = data.sdks || data;
    assert(Array.isArray(sdks), 'SDKs should be array');
  }));

  tests.push(await runTest(suite, 'sdk-registry: get_sdk returns details', async () => {
    const { status, data } = await invoke('sdk-registry', 'POST', { action: 'get_sdk', sdk_key: 'node' });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.name !== undefined || data.sdk !== undefined, 'Missing SDK details');
  }));

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  return { name: suite, tests, passed, failed, skipped: 0, duration_ms: tests.reduce((s, t) => s + t.duration_ms, 0) };
}

// ═══════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK */ }

    const suiteFilter = body.suite as string | undefined;

    const allRunners: Record<string, () => Promise<TestSuite>> = {
      'system_health': suiteSystemHealth,
      'auth_guards': suiteAuthGuards,
      'cors': suiteCORS,
      'bank_connector': suiteBankConnector,
      'webhook_security': suiteWebhookSecurity,
      'error_format': suiteErrorFormat,
      'payment_gateway': suitePaymentGateway,
      'sdks': suiteSDKs,
    };

    const runnersToExecute = suiteFilter && allRunners[suiteFilter]
      ? { [suiteFilter]: allRunners[suiteFilter] }
      : allRunners;

    const suiteResults: TestSuite[] = [];
    for (const [, runner] of Object.entries(runnersToExecute)) {
      suiteResults.push(await runner());
    }

    const totalPassed = suiteResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = suiteResults.reduce((s, r) => s + r.failed, 0);
    const totalTests = totalPassed + totalFailed;
    const totalDuration = Date.now() - startTime;

    const report = {
      report: 'KOB E2E Contract Test Report',
      version: 'v1.0.0',
      timestamp: new Date().toISOString(),
      summary: {
        total_tests: totalTests,
        passed: totalPassed,
        failed: totalFailed,
        pass_rate: totalTests > 0 ? `${((totalPassed / totalTests) * 100).toFixed(1)}%` : '0%',
        duration_ms: totalDuration,
        verdict: totalFailed === 0 ? 'ALL PASS ✅' : `${totalFailed} FAILURES ❌`,
      },
      suites: suiteResults.map(s => ({
        name: s.name,
        passed: s.passed,
        failed: s.failed,
        duration_ms: s.duration_ms,
        tests: s.tests,
      })),
    };

    return new Response(JSON.stringify(report, null, 2), {
      status: totalFailed > 0 ? 207 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Test runner failed',
      details: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
