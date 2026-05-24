/**
 * consumer-app-regression.test.ts
 *
 * Re-runs the deep pen-test checks for the Consumer mobile app on every CI run
 * so regressions (broken routes, missing pages, dead edge-function invocations,
 * stripped PIN gates, broken help-link destinations) can never reach production.
 *
 * The test deliberately reads source artifacts (App.tsx, page files, the
 * supabase/functions tree) rather than running a live server — so it catches
 * the same class of issues we found during the 2026-05-23 manual audit
 * without needing a deployed environment.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const APP_TSX_PATH = path.join(ROOT, 'src/App.tsx');
const APP_TSX = fs.readFileSync(APP_TSX_PATH, 'utf8');
const PAGES_DIR = path.join(ROOT, 'src/pages/customer-app');
const FNS_DIR = path.join(ROOT, 'supabase/functions');

// ─── Parse App.tsx imports so component → source path lookups are accurate ───
type ImportMap = Map<string, string>;
function buildImportMap(): ImportMap {
  const map: ImportMap = new Map();
  // Static imports: default + named.
  const RE = /import\s+(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of APP_TSX.matchAll(RE)) {
    const def = m[1];
    const named = m[2];
    const source = m[3];
    if (def) map.set(def, source);
    if (named) {
      for (const part of named.split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name) map.set(name, source);
      }
    }
  }
  // Lazy imports: `const X = lazy(() => import("path")...)`
  const LAZY_RE = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g;
  for (const m of APP_TSX.matchAll(LAZY_RE)) {
    map.set(m[1], m[2]);
  }
  return map;
}

function resolveSourceToFile(source: string): string | null {
  if (!source.startsWith('@/')) return null;
  const rel = source.replace(/^@\//, '');
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    const full = path.join(ROOT, 'src', rel + ext);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const importMap = buildImportMap();

// Capture every <X /> used as a Route element, including <Layout><X /></Layout>.
const ROUTE_ELEMENT_RE = /<Route\s+path="([^"]+)"\s+element={([^}]+)}/g;
const COMPONENT_RE = /<(\w+)\b/g;

type RouteEntry = { path: string; components: string[] };
const routeEntries: RouteEntry[] = [];
for (const m of APP_TSX.matchAll(ROUTE_ELEMENT_RE)) {
  const components: string[] = [];
  for (const cm of m[2].matchAll(COMPONENT_RE)) {
    const name = cm[1];
    if (/^[A-Z]/.test(name) && name !== 'Layout' && name !== 'Navigate') {
      components.push(name);
    }
  }
  routeEntries.push({ path: m[1], components });
}
const declaredRoutePaths = new Set(routeEntries.map((r) => r.path));
const allRouteComponents = new Set(routeEntries.flatMap((r) => r.components));

describe('Consumer App Regression — routes', () => {
  it('every Customer* component used as a route resolves to a real source file', () => {
    const missing: Array<{ component: string; reason: string }> = [];
    for (const name of allRouteComponents) {
      if (!name.startsWith('Customer')) continue;
      const source = importMap.get(name);
      if (!source) {
        missing.push({ component: name, reason: 'not imported in App.tsx' });
        continue;
      }
      const file = resolveSourceToFile(source);
      if (!file) {
        missing.push({ component: name, reason: `import "${source}" does not resolve` });
      }
    }
    expect(
      missing,
      `Route components missing source files: ${missing.map((m) => `${m.component} (${m.reason})`).join('; ')}`,
    ).toEqual([]);
  });
});

// ─── 2. supabase.functions.invoke('x') ↔ deployed fn parity ──────────────────
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
      const idx = path.join(FNS_DIR, fn, 'index.ts');
      if (!fs.existsSync(idx)) missing.push(fn);
    }
    expect(
      missing,
      `Edge functions invoked but not deployed: ${missing.join(', ')}`,
    ).toEqual([]);
  });
});

// ─── 3. PIN-gated financial mutation pages ───────────────────────────────────
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

// ─── 4. Help quick-links resolve to real routes ──────────────────────────────
describe('Consumer App Regression — help quick-links', () => {
  it('every quickLinks path in CustomerHelp.tsx is registered as a route', () => {
    const help = fs.readFileSync(path.join(PAGES_DIR, 'CustomerHelp.tsx'), 'utf8');
    const QL_RE = /path:\s*['"`](\/[a-z0-9\-\/]*)['"`]/gi;
    const broken: string[] = [];
    for (const m of help.matchAll(QL_RE)) {
      const p = m[1];
      // strip params and ignore mailto/anchor stub paths
      if (!declaredRoutePaths.has(p)) broken.push(p);
    }
    expect(broken, `Help quick-links missing routes: ${broken.join(', ')}`).toEqual([]);
  });
});
