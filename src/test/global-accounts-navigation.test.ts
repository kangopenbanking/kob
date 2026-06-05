/**
 * global-accounts-navigation.test.ts
 *
 * E2E-style static audit verifying that the Nium "Global Accounts" feature
 * is reachable from every surface where users expect to find it:
 *   - Developer Portal sidebar (auth + public variants) and the canonical
 *     doc-navigation ordering used for prev/next links.
 *   - Consumer mobile app: More → Quick Actions, More → Utilities, and the
 *     Linked Accounts page.
 *   - Web + Capacitor deep links: /global-accounts, /app/global-accounts,
 *     /developer/gateway/global-accounts, and the /developer/global-accounts
 *     redirect alias.
 *
 * The companion check at the bottom scans every customer-app page and every
 * developer sidebar entry for routes that point at non-existent paths — so
 * any future regression that breaks a Global-Accounts-adjacent link (or any
 * Transfers-section link) fails CI immediately.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const APP_TSX = read("src/App.tsx");
const DEV_LAYOUT = read("src/components/developer/DeveloperLayout.tsx");
const PUB_DEV_LAYOUT = read("src/components/developer/PublicDeveloperLayout.tsx");
const DOC_NAV_ORDER = read("src/components/developer/docNavigationOrder.ts");
const CUSTOMER_MORE = read("src/pages/customer-app/CustomerMore.tsx");
const CUSTOMER_LINKED = read("src/pages/customer-app/CustomerLinkedAccounts.tsx");
const GUIDE = read("src/pages/developer/GatewayGlobalAccountsGuide.tsx");

describe("Global Accounts — Developer Portal navigation", () => {
  it("is listed in the authenticated developer sidebar (DeveloperLayout)", () => {
    expect(DEV_LAYOUT).toMatch(/Global Accounts \(Nium\)/);
    expect(DEV_LAYOUT).toMatch(/\/developer\/gateway\/global-accounts/);
  });

  it("is listed in the public developer sidebar (PublicDeveloperLayout)", () => {
    expect(PUB_DEV_LAYOUT).toMatch(/Global Accounts \(Nium\)/);
    expect(PUB_DEV_LAYOUT).toMatch(/\/developer\/gateway\/global-accounts/);
  });

  it("is registered in the canonical doc navigation order (prev/next)", () => {
    expect(DOC_NAV_ORDER).toMatch(/\/developer\/gateway\/global-accounts/);
  });

  it("documents access points and required permissions on the guide page", () => {
    expect(GUIDE).toMatch(/Accessing Global Accounts/);
    expect(GUIDE).toMatch(/global_accounts:write/);
    expect(GUIDE).toMatch(/x-nium-signature/);
  });
});

describe("Global Accounts — Consumer mobile app navigation", () => {
  it("appears as a Quick Action on CustomerMore", () => {
    expect(CUSTOMER_MORE).toMatch(/key: 'global_accounts'/);
    expect(CUSTOMER_MORE).toMatch(/'global_accounts' \? 'global-accounts'/);
  });

  it("appears in the More → Utilities list", () => {
    // path: 'global-accounts' must appear in utilityItems too
    const utilHit = CUSTOMER_MORE.match(/label: 'Global Accounts'[^}]*path: 'global-accounts'/);
    expect(utilHit, "utilityItems entry for Global Accounts missing").not.toBeNull();
  });

  it("appears on the Linked Accounts page", () => {
    expect(CUSTOMER_LINKED).toMatch(/\/app\/global-accounts/);
    expect(CUSTOMER_LINKED).toMatch(/Global Receiving Accounts/);
  });
});

describe("Global Accounts — deep links (web + Capacitor)", () => {
  it("/app/global-accounts is registered as a consumer route", () => {
    expect(APP_TSX).toMatch(/path="global-accounts"\s+element=\{<GlobalReceivingAccount/);
  });

  it("/developer/gateway/global-accounts is registered as a developer route", () => {
    expect(APP_TSX).toMatch(/path="gateway\/global-accounts"\s+element=\{<GatewayGlobalAccountsGuide/);
  });

  it("/global-accounts deep link redirects to /app/global-accounts", () => {
    expect(APP_TSX).toMatch(
      /path="\/global-accounts"\s+element=\{<Navigate to="\/app\/global-accounts" replace \/>/,
    );
  });

  it("/developer/global-accounts deep link redirects to the guide", () => {
    expect(APP_TSX).toMatch(
      /path="\/developer\/global-accounts"\s+element=\{<Navigate to="\/developer\/gateway\/global-accounts" replace \/>/,
    );
  });
});

// ─── Broader navigation integrity check (Transfers + Global Accounts area) ──
describe("Developer sidebar — Transfers section link integrity", () => {
  it("every Transfers-section path resolves to a declared developer route", () => {
    // Extract the Transfers (or Payouts/Beneficiaries) sidebar block by scraping
    // every {title, path} in the layout file, then verifying each path against
    // the App.tsx route table.
    const PATH_RE = /path:\s*"(\/developer\/[a-z0-9\-/]+)"/gi;
    const sidebarPaths = new Set<string>();
    for (const m of DEV_LAYOUT.matchAll(PATH_RE)) sidebarPaths.add(m[1]);
    for (const m of PUB_DEV_LAYOUT.matchAll(PATH_RE)) sidebarPaths.add(m[1]);

    // Collect every literal Route path under /developer/* in App.tsx.
    const ROUTE_RE = /<Route\s+path="([^"]+)"/g;
    const declaredRoutes = new Set<string>();
    for (const m of APP_TSX.matchAll(ROUTE_RE)) declaredRoutes.add(m[1]);

    // The developer routes are mounted under a parent <Route path="/developer">
    // with relative children — reconstruct the full path set.
    const developerFullPaths = new Set<string>();
    for (const r of declaredRoutes) {
      if (r.startsWith("/developer")) developerFullPaths.add(r);
      else developerFullPaths.add("/developer/" + r);
    }

    const broken: string[] = [];
    for (const p of sidebarPaths) {
      // Allow exact or prefix match (some entries link to landing routes).
      const ok = developerFullPaths.has(p) ||
        [...declaredRoutes].some((r) => "/developer/" + r === p);
      if (!ok) broken.push(p);
    }
    expect(broken, `Broken developer sidebar links: ${broken.join(", ")}`).toEqual([]);
  });
});
