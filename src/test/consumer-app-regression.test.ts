/**
 * consumer-app-regression.test.ts
 *
 * Re-runs the deep pen-test checks for the Consumer mobile app on every CI run
 * so regressions (broken routes, missing pages, dead edge-function invocations,
 * stripped PIN gates) can never reach production.
 *
 * Verifies, statically:
 *   1. Every /app/* route in src/App.tsx points to an importable page module
 *      with a valid React default export.
 *   2. Every supabase.functions.invoke('name') referenced from a customer-app
 *      page has a matching supabase/functions/<name>/index.ts on disk.
 *   3. Every page that performs a financial mutation imports PinConfirmDialog.
 *   4. The Help page's quick-links point to routes that exist in App.tsx.
 *
 * Wired into the phase6-e2e workflow so failures block merge.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const APP_TSX = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
const PAGES_DIR = path.join(ROOT, 'src/pages/customer-app');
const FNS_DIR = path.join(ROOT, 'supabase/functions');

// ---------- 1. /app/* route ↔ page module parity ----------
const ROUTE_RE = /<Route\s+path="([^"]+)"\s+element={<(\w+)\s*\/>/g;
const appRoutes: Array<{ path: string; component: string }> = [];
for (const m of APP_TSX.matchAll(ROUTE_RE)) {
  appRoutes.push({ path: m[1], component: m[2] });
}
const consumerComponents = appRoutes
  .filter((r) => r.component.startsWith('Customer'))
  .map((r) => r.component);

describe('Consumer App Regression — routes', () => {
  it('every Customer* component referenced in App.tsx has a page module', () => {
    const missing: string[] = [];
    for (const name of new Set(consumerComponents)) {
      const file = path.join(PAGES_DIR, `${name}.tsx`);
      if (!fs.existsSync(file)) missing.push(name);
    }
    expect(missing, `Missing page modules: ${missing.join(', ')}`).toEqual([]);
  });

  it('every customer-app page file has a default export', () => {
    const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.tsx'));
    const noDefault: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(PAGES_DIR, f), 'utf8');
      if (!/export\s+default\s+/m.test(src)) noDefault.push(f);
    }
    expect(noDefault, `Pages missing default export: ${noDefault.join(', ')}`).toEqual([]);
  });
});

// ---------- 2. supabase.functions.invoke('x') ↔ deployed fn parity ----------
const INVOKE_RE = /supabase\.functions\.invoke\(\s*['"`]([a-z0-9-]+)['"`]/g;

function collectInvokes(dir: string): Set<string> {
  const out = new Set<string>();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectInvokes(p).forEach((x) => out.add(x));
    } else if (/\.(t|j)sx?$/.test(entry.name)) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(INVOKE_RE)) out.add(m[1]);
    }
  }
  return out;
}

describe('Consumer App Regression — edge functions', () => {
  it('every supabase.functions.invoke target referenced from customer-app is deployed', () => {
    const invoked = collectInvokes(PAGES_DIR);
    const missing: string[] = [];
    for (const fn of invoked) {
      const dir = path.join(FNS_DIR, fn);
      const idx = path.join(dir, 'index.ts');
      if (!fs.existsSync(idx)) missing.push(fn);
    }
    expect(missing, `Edge functions invoked but not deployed: ${missing.join(', ')}`).toEqual([]);
  });
});

// ---------- 3. PIN-gated financial mutation pages ----------
const PIN_REQUIRED_PAGES = [
  'CustomerTransfer.tsx',
  'CustomerSendMoney.tsx',
  'CustomerCashOut.tsx',
  'CustomerFundWallet.tsx',
  'CustomerPiggyBank.tsx',
  'CustomerSavingsVault.tsx',
  'CustomerNjangi.tsx',
];

describe('Consumer App Regression — security gates', () => {
  it('financial mutation pages still import PinConfirmDialog', () => {
    const stripped: string[] = [];
    for (const f of PIN_REQUIRED_PAGES) {
      const file = path.join(PAGES_DIR, f);
      if (!fs.existsSync(file)) continue; // covered by route-parity test
      const src = fs.readFileSync(file, 'utf8');
      if (!/PinConfirmDialog/.test(src)) stripped.push(f);
    }
    expect(stripped, `PIN gate removed from: ${stripped.join(', ')}`).toEqual([]);
  });
});

// ---------- 4. CustomerHelp quick-links resolve ----------
describe('Consumer App Regression — help quick-links', () => {
  it('every quickLinks path in CustomerHelp.tsx is registered as a route', () => {
    const help = fs.readFileSync(path.join(PAGES_DIR, 'CustomerHelp.tsx'), 'utf8');
    const QL_RE = /path:\s*['"`](\/[a-z0-9\-\/]*)['"`]/gi;
    const declaredPaths = new Set(appRoutes.map((r) => r.path));
    const broken: string[] = [];
    for (const m of help.matchAll(QL_RE)) {
      const p = m[1];
      if (!declaredPaths.has(p)) broken.push(p);
    }
    expect(broken, `Help quick-links missing routes: ${broken.join(', ')}`).toEqual([]);
  });
});
