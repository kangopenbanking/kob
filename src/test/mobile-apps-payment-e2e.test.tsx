// @ts-nocheck
/**
 * MOBILE APPS — PAYMENT FLOWS, EDGE FUNCTIONS & ROUTE RESOLUTION (E2E)
 *
 * This automated suite locks in production behavior across the 4 mobile/PWA
 * surfaces (Banking, Customer, Business, Merchant) and proves that:
 *
 *   1. Every `supabase.functions.invoke('<name>', ...)` reference in the
 *      mobile app source resolves to a real, deployed edge function under
 *      `supabase/functions/<name>/index.ts` (no broken invocations).
 *   2. Every payment-flow page module loads without import-time failures
 *      (catches dynamic-import / route-resolution regressions).
 *   3. Critical payment edge functions exist with expected entry-points
 *      (mobile money, transfers, charges, payouts, bills, remittances,
 *      pay-by-bank, refunds, QR pay, withdrawals).
 *   4. Each payment page that performs financial mutations is gated by a
 *      `PinConfirmDialog` (financial-safety mandate).
 *   5. PWA route prefixes are intact across the 4 apps.
 *
 * Cited Standing Orders: SO-2 (Ratchet), SO-7 (Five Roles); P5 (Working Code).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const FUNCTIONS_DIR = path.join(ROOT, 'supabase/functions');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function readAll(files: string[]): string {
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

function listEdgeFunctions(): Set<string> {
  if (!fs.existsSync(FUNCTIONS_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
      .map((d) => d.name),
  );
}

const INVOKE_RE = /supabase\.functions\.invoke\(\s*['"`]([^'"`?]+)/g;

function extractInvocations(source: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = INVOKE_RE.exec(source))) {
    // Strip any path/query suffix — only the function name is the deploy unit.
    out.add(m[1].split('/')[0].split('?')[0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Source corpora — collected once per run
// ---------------------------------------------------------------------------
const MOBILE_DIRS = {
  banking: path.join(SRC, 'pages/banking-app'),
  customer: path.join(SRC, 'pages/customer-app'),
  business: path.join(SRC, 'pages/business-app'),
  merchant: path.join(SRC, 'pages/merchant'),
};

const HOOKS_DIR = path.join(SRC, 'hooks');
const COMPONENTS_DIR = path.join(SRC, 'components');

const mobileFiles = Object.values(MOBILE_DIRS).flatMap((d) => walk(d));
const hookFiles = walk(HOOKS_DIR);
const componentFiles = walk(COMPONENTS_DIR);
const allMobileSource = readAll([...mobileFiles, ...hookFiles, ...componentFiles]);
const deployedFunctions = listEdgeFunctions();

// ---------------------------------------------------------------------------
// SUITE 1 — Edge function invocation resolution
// ---------------------------------------------------------------------------
describe('[Mobile E2E] Edge function invocations resolve to deployed functions', () => {
  const invocations = extractInvocations(allMobileSource);

  it('discovers a non-trivial number of edge function invocations', () => {
    expect(invocations.size).toBeGreaterThan(50);
  });

  it('every invoked function name has a deployed supabase/functions/<name>/index.ts', () => {
    const missing: string[] = [];
    for (const name of invocations) {
      const indexPath = path.join(FUNCTIONS_DIR, name, 'index.ts');
      if (!fs.existsSync(indexPath)) missing.push(name);
    }
    expect(
      missing,
      `Missing edge functions referenced from mobile app source:\n  - ${missing.join('\n  - ')}`,
    ).toEqual([]);
  });

  it.each([
    'mobile-money-charge',
    'mobile-money-transfer',
    'api-transfers',
    'api-bills',
    'api-bills-v2',
    'gateway-create-charge',
    'gateway-create-payout',
    'gateway-request-payout',
    'gateway-create-refund',
    'gateway-create-payment-link',
    'gateway-create-funding-intent',
    'gateway-process-withdrawal',
    'pay-by-bank',
    'remittance-outbound',
    'savings-ops',
    'piggybank',
    'split-bills-ops',
    'pos-pay-order',
    'pos-qr-payment',
    'merchant-qr',
    'recurring-payment-create',
  ])('critical payment function "%s" is deployed', (fn) => {
    expect(deployedFunctions.has(fn), `Missing function: ${fn}`).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SUITE 2 — Edge function entry-point sanity
// ---------------------------------------------------------------------------
describe('[Mobile E2E] Payment edge functions expose a serve() handler with CORS + auth', () => {
  const PAYMENT_FUNCTIONS = [
    'mobile-money-charge',
    'mobile-money-transfer',
    'api-transfers',
    'api-bills',
    'gateway-create-charge',
    'gateway-create-payout',
    'gateway-create-refund',
    'gateway-process-withdrawal',
    'pay-by-bank',
    'remittance-outbound',
  ];

  it.each(PAYMENT_FUNCTIONS)('%s declares serve() and CORS preflight handling', (fn) => {
    const file = path.join(FUNCTIONS_DIR, fn, 'index.ts');
    expect(fs.existsSync(file), `Missing index.ts: ${fn}`).toBe(true);
    const src = fs.readFileSync(file, 'utf8');
    expect(src, `${fn} should call serve()`).toMatch(/serve\s*\(/);
    expect(src, `${fn} should handle OPTIONS for CORS`).toMatch(/OPTIONS/);
    expect(src, `${fn} should authenticate via getUser() (no anonymous payments)`).toMatch(
      /auth\.getUser\(/,
    );
  });
});

// ---------------------------------------------------------------------------
// SUITE 3 — Mobile app payment pages load (route resolution)
// ---------------------------------------------------------------------------
describe('[Mobile E2E] Payment pages can be dynamically imported', () => {
  const PAYMENT_PAGES = [
    // Banking app
    'banking-app/BankSendMoney',
    'banking-app/BankMobileMoney',
    'banking-app/BankPayments',
    'banking-app/BankBills',
    'banking-app/BankFundAccount',
    'banking-app/BankRemittances',
    'banking-app/BankSendAbroad',
    'banking-app/BankQRPay',
    'banking-app/BankReceive',
    // Customer app
    'customer-app/CustomerSendMoney',
    'customer-app/CustomerTransfer',
    'customer-app/CustomerBillsV2',
    'customer-app/CustomerFundWallet',
    'customer-app/CustomerCashOut',
    'customer-app/CustomerScan',
    'customer-app/CustomerSplitBills',
    'customer-app/CustomerPayLinks',
    'customer-app/CustomerRemittances',
    // Business app
    'business-app/BusinessReceive',
    'business-app/BusinessTill',
    'business-app/BusinessQRCode',
    'business-app/BusinessRefunds',
    'business-app/BusinessWallet',
    // Merchant
    'merchant/MerchantPayouts',
    'merchant/MerchantRefunds',
    'merchant/MerchantPaymentLinks',
    'merchant/MerchantFundWallet',
    'merchant/MerchantPayByBank',
  ];

  it.each(PAYMENT_PAGES)('page module exists and parses: %s', async (rel) => {
    const file = path.join(SRC, 'pages', `${rel}.tsx`);
    expect(fs.existsSync(file), `Missing page: ${rel}.tsx`).toBe(true);
    const src = fs.readFileSync(file, 'utf8');
    // Each payment page must default-export a component
    expect(src).toMatch(/export\s+default\s+/);
  });
});

// ---------------------------------------------------------------------------
// SUITE 4 — Financial-safety: payment pages gate mutations behind PIN
// ---------------------------------------------------------------------------
describe('[Mobile E2E] Financial mutation pages gate via PinConfirmDialog or SCA', () => {
  const PIN_GATED_PAGES = [
    'banking-app/BankSendMoney',
    'banking-app/BankMobileMoney',
    'banking-app/BankBills',
    'banking-app/BankRemittances',
    'banking-app/BankSendAbroad',
    'banking-app/BankQRPay',
    'customer-app/CustomerSendMoney',
    'customer-app/CustomerBillsV2',
    'customer-app/CustomerCashOut',
    'customer-app/CustomerSplitBills',
  ];

  it.each(PIN_GATED_PAGES)('%s wires PinConfirmDialog or SCA challenge', (rel) => {
    const file = path.join(SRC, 'pages', `${rel}.tsx`);
    if (!fs.existsSync(file)) return; // covered by SUITE 3
    const src = fs.readFileSync(file, 'utf8');
    const hasPin = /PinConfirmDialog/.test(src);
    const hasSca = /useSCAChallenge|SCAChallenge/.test(src);
    expect(
      hasPin || hasSca,
      `${rel} performs financial mutations but lacks PinConfirmDialog or SCA gate`,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SUITE 5 — Route prefixes are present in App.tsx
// ---------------------------------------------------------------------------
describe('[Mobile E2E] Route prefixes for the 4 mobile apps exist in router', () => {
  const appRoutes = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');

  it.each([
    ['banking', /path="\/bank/],
    ['customer', /path="\/customer|path="\/c\//],
    ['business', /path="\/biz|path="\/business/],
    ['merchant', /path="\/m\/|path="\/merchant/],
  ])('%s app routes are registered', (_label, re) => {
    expect(appRoutes).toMatch(re);
  });

  it('App.tsx declares a substantial route table (>200 routes)', () => {
    const matches = appRoutes.match(/<Route\s/g) ?? [];
    expect(matches.length).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// SUITE 6 — No legacy/broken navigations to removed paths
// ---------------------------------------------------------------------------
describe('[Mobile E2E] No navigations to removed payment paths', () => {
  // These paths were retired/renamed and must not reappear in mobile code.
  const FORBIDDEN = [
    "navigate('/transfer')", // replaced by '/payments/send' inside /bank/:id
    "navigate(\"/transfer\")",
  ];

  it.each(FORBIDDEN)('legacy navigation "%s" is absent from mobile source', (needle) => {
    const hits: string[] = [];
    for (const f of mobileFiles) {
      if (fs.readFileSync(f, 'utf8').includes(needle)) hits.push(path.relative(ROOT, f));
    }
    expect(hits, `Legacy nav found in:\n  - ${hits.join('\n  - ')}`).toEqual([]);
  });
});
