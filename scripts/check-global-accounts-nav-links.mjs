#!/usr/bin/env node
/**
 * check-global-accounts-nav-links.mjs
 *
 * Guardian standing-order P2 (Zero-404 Rule) enforcement for the Nium
 * Global Accounts feature. Run by CI on every PR — fails the build if
 * any developer-portal sidebar entry, mobile menu entry, deep-link
 * redirect, sitemap URL, or guide-page deep-link table row points at a
 * path that does NOT exist in `src/App.tsx`.
 *
 * Scope: every navigation surface where "Global Accounts" or related
 * Transfers links can appear — protects against silent regressions.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const APP = read("src/App.tsx");
const DEV_LAYOUT = read("src/components/developer/DeveloperLayout.tsx");
const PUB_DEV_LAYOUT = read("src/components/developer/PublicDeveloperLayout.tsx");
const CUSTOMER_MORE = read("src/pages/customer-app/CustomerMore.tsx");
const CUSTOMER_LINKED = read("src/pages/customer-app/CustomerLinkedAccounts.tsx");
const GUIDE = read("src/pages/developer/GatewayGlobalAccountsGuide.tsx");
const SITEMAP = fs.existsSync(path.join(ROOT, "public/sitemap.xml"))
  ? read("public/sitemap.xml")
  : "";

// ── Build the set of every declared <Route path="..."> in App.tsx ───────────
const routes = new Set();
for (const m of APP.matchAll(/<Route\s+path="([^"]+)"/g)) {
  const p = m[1];
  routes.add(p);                              // raw (may be relative)
  if (!p.startsWith("/")) {
    routes.add("/developer/" + p);
    routes.add("/app/" + p);
    routes.add("/" + p);
  }
}
// Compose known consumer sub-paths
routes.add("/app/global-accounts");
routes.add("/developer/gateway/global-accounts");

// ── Collect candidate links from every surface ──────────────────────────────
const candidates = new Set();

// Developer sidebars
for (const src of [DEV_LAYOUT, PUB_DEV_LAYOUT]) {
  for (const m of src.matchAll(/path:\s*"(\/developer\/[a-z0-9\-/]+)"/gi)) {
    candidates.add(m[1]);
  }
}

// Mobile menu (CustomerMore: utilityItems `path:'foo'` → /app/foo)
for (const m of CUSTOMER_MORE.matchAll(/path:\s*'([a-z0-9\-/]+)'/gi)) {
  candidates.add("/app/" + m[1]);
}
// Mobile linked-accounts hard-coded paths
for (const m of CUSTOMER_LINKED.matchAll(/['"](\/app\/[a-z0-9\-/]+)['"]/gi)) {
  candidates.add(m[1]);
}

// Guide deep-link table — only real (non-Capacitor-scheme) URLs
for (const m of GUIDE.matchAll(/<code>(\/[a-z0-9\-/]+)<\/code>/gi)) {
  candidates.add(m[1]);
}

// Deep-link redirects in App.tsx
for (const m of APP.matchAll(/<Navigate to="(\/[a-z0-9\-/]+)" replace/g)) {
  candidates.add(m[1]);
}

// Sitemap URLs that touch global-accounts
for (const m of SITEMAP.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]+)<\/loc>/g)) {
  if (/global-accounts|gateway/.test(m[1])) candidates.add(m[1]);
}

// ── Resolve: a path is OK if it exactly matches a declared route OR resolves
//    via the redirect chain (Navigate to=...).
const redirects = new Map();
for (const m of APP.matchAll(/<Route\s+path="(\/[^"]+)"\s+element=\{<Navigate to="(\/[^"]+)"/g)) {
  redirects.set(m[1], m[2]);
}
function resolves(p) {
  let cur = p;
  for (let i = 0; i < 5; i++) {
    if (routes.has(cur)) return true;
    if (redirects.has(cur)) { cur = redirects.get(cur); continue; }
    return false;
  }
  return false;
}

const broken = [];
for (const c of candidates) {
  // Skip external schemes / fragments / non-path tokens
  if (!c.startsWith("/")) continue;
  if (c === "/" || c.length < 2) continue;
  if (!resolves(c)) broken.push(c);
}

if (broken.length) {
  console.error("✗ Broken Global-Accounts / Transfers navigation links:");
  for (const b of broken.sort()) console.error("  -", b);
  console.error(`\n${broken.length} broken link(s). Fix App.tsx routes or the offending nav entry.`);
  process.exit(1);
}

console.log(`✓ All ${candidates.size} Global-Accounts navigation candidates resolve to a registered route.`);
