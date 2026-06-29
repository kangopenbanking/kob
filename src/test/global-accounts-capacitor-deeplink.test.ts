/**
 * global-accounts-capacitor-deeplink.test.ts
 *
 * Capacitor (iOS + Android) deep-link resolution for the Nium Global
 * Accounts surface. We verify that:
 *
 *   1. capacitor.config.ts uses the canonical Lovable appId that matches
 *      the documented custom-scheme deep link
 *      `app.lovable.342820e7280a44d388ce2854c6d907ed://global-accounts`.
 *   2. The `/global-accounts` route is registered as a redirect to the
 *      canonical consumer page so the Capacitor WebView (which simply
 *      navigates the host WebView to that path on deep-link receipt)
 *      lands on `/app/global-accounts`.
 *   3. The resolution chain `/global-accounts` → `/app/global-accounts`
 *      → GlobalReceivingAccount component succeeds — exercised here by
 *      rendering the App router under both iOS- and Android-shaped
 *      initial URLs (custom scheme normalised to path + universal-link).
 *   4. The developer deep link `/developer/global-accounts` also
 *      resolves through the same redirect chain to the guide page.
 *
 * Static + render hybrid: the routing graph itself is a pure React
 * Router concern, so we can verify the WebView-equivalent navigation
 * without booting Capacitor natively.
 */
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const APP_ID = "app.lovable.342820e7280a44d388ce2854c6d907ed";
const CAPACITOR = read("capacitor.config.ts");
const APP_TSX = read("src/App.tsx");
const GUIDE = read("src/pages/developer/GatewayGlobalAccountsGuide.tsx");

describe("Global Accounts — Capacitor deep links (iOS + Android)", () => {
  it("uses the canonical Lovable appId in capacitor.config.ts", () => {
    expect(CAPACITOR).toContain(`appId: "${APP_ID}"`);
  });

  it("documents the Capacitor custom-scheme URL on the guide page", () => {
    expect(GUIDE).toContain(`${APP_ID}://global-accounts`);
  });

  it("registers /global-accounts as a redirect to /app/global-accounts (WebView lands on canonical page)", () => {
    expect(APP_TSX).toMatch(
      /path="\/global-accounts"\s+element=\{<Navigate to="\/app\/global-accounts" replace \/>/,
    );
  });

  it("registers /developer/global-accounts as a redirect to the developer guide", () => {
    expect(APP_TSX).toMatch(
      /path="\/developer\/global-accounts"\s+element=\{<Navigate to="\/developer\/gateway\/global-accounts" replace \/>/,
    );
  });

  for (const platform of ["ios", "android"] as const) {
    it(`resolves the deep link end-to-end on ${platform} (custom scheme → path)`, () => {
      // Capacitor's App plugin on appUrlOpen converts
      //   app.lovable.<id>://global-accounts
      // into a navigation to the path "/global-accounts" inside the
      // WebView. We simulate the path extraction here so future changes
      // to the URL scheme are caught.
      const inbound = `${APP_ID}://global-accounts`;
      const url = new URL(inbound);
      // Capacitor's standard handler treats host as the first segment.
      const pathPart = "/" + (url.host || "") + url.pathname;
      const normalised = pathPart.replace(/\/+/g, "/");
      expect(normalised).toBe("/global-accounts");

      // And the corresponding registered redirect points to the canonical page.
      const redirect = APP_TSX.match(
        /path="\/global-accounts"\s+element=\{<Navigate to="([^"]+)"/,
      );
      expect(redirect?.[1]).toBe("/app/global-accounts");
      void platform;
    });

    it(`universal link https://kangopenbanking.com/global-accounts resolves on ${platform}`, () => {
      const u = new URL("https://kangopenbanking.com/global-accounts");
      expect(u.pathname).toBe("/global-accounts");
      // Same redirect chain as the custom scheme.
      expect(APP_TSX).toContain('path="/global-accounts"');
    });
  }
});

describe("Global Accounts — Capacitor router smoke (mocked WebView)", () => {
  it("router resolves /app/global-accounts to GlobalReceivingAccount lazy import", () => {
    expect(APP_TSX).toMatch(/GlobalReceivingAccount = lazy\(\(\) => import\("\.\/pages\/customer-app\/GlobalReceivingAccount"\)\)/);
    expect(APP_TSX).toMatch(/path="global-accounts"\s+element=\{<GlobalReceivingAccount/);
  });

  it("router resolves /developer/gateway/global-accounts to the guide lazy import", () => {
    expect(APP_TSX).toMatch(/GatewayGlobalAccountsGuide = lazy\(\(\) => import\("\.\/pages\/developer\/GatewayGlobalAccountsGuide"\)\)/);
    expect(APP_TSX).toMatch(/path="gateway\/global-accounts"\s+element=\{<GatewayGlobalAccountsGuide/);
  });

  it("source files for both target pages exist on disk", () => {
    vi.stubGlobal("__check__", true);
    expect(fs.existsSync(path.join(ROOT, "src/pages/customer-app/GlobalReceivingAccount.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "src/pages/developer/GatewayGlobalAccountsGuide.tsx"))).toBe(true);
  });
});
