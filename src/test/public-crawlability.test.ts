// @ts-nocheck
/**
 * Crawlability + public-access regression gate.
 *
 * Enforces the PERMANENT PUBLIC ROUTES guarantees (Orders P1, P2, P4, P6, P8):
 *   - robots.txt allows /developer, /openapi.json, /openapi.yaml, /changelog.json,
 *     /apis.json, /.well-known/ai-plugin.json and points at the sitemap.
 *   - public/_headers sets `x-robots-tag: all` (NEVER noindex) on every public
 *     spec/doc surface.
 *   - sitemap.xml lists the developer landing page, OpenAPI explorer, and the
 *     newly published Issuing reference page.
 *   - llms.txt advertises the Issuing reference for AI crawlers.
 *   - No /developer/* route in src/App.tsx is wrapped in an auth guard
 *     (ProtectedRoute / RequireAuth / AuthGuard) except admin-only operational
 *     pages: /developer/deployment-status and /developer/env-vars.
 *   - No /developer page source contains a `Navigate to="/auth"` redirect.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const PUBLIC_DOC_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/openapi-sandbox.json",
  "/openapi-sandbox.yaml",
  "/changelog.json",
  "/apis.json",
  "/sitemap.xml",
];

describe("robots.txt — public crawl rules", () => {
  const robots = read("public/robots.txt");
  it("declares the sitemap", () => {
    expect(robots).toMatch(/Sitemap:\s+https:\/\/kangopenbanking\.com\/sitemap\.xml/);
  });
  it.each([
    "/developer",
    "/openapi.json",
    "/changelog.json",
    "/apis.json",
    "/.well-known/ai-plugin.json",
  ])("Allow rule present for %s", (p) => {
    expect(robots).toContain(`Allow: ${p}`);
  });
  it("allows only known admin-only Disallow under /developer", () => {
    const disallowed = (robots.match(/^Disallow: .*/gm) || []).filter(
      (l) => l.startsWith("Disallow: /developer") || l.startsWith("Disallow: /openapi")
    );
    const allowedExceptions = [
      "Disallow: /developer/deployment-status",
      "Disallow: /developer/env-vars",
    ];
    const offenders = disallowed.filter((d) => !allowedExceptions.includes(d));
    expect(offenders, `Unexpected Disallow rules: ${offenders.join(", ")}`).toHaveLength(0);
  });
});

describe("_headers — public spec & docs are crawlable (x-robots-tag: all)", () => {
  const headers = read("public/_headers");
  it.each([
    "/openapi.json",
    "/openapi.yaml",
    "/changelog.json",
    "/apis.json",
    "/sitemap.xml",
    "/developer/*",
  ])("%s declares x-robots-tag: all and never noindex", (route) => {
    // Locate the rule block: the route appears on its own line at SOF or after a blank line.
    const needle1 = `\n${route}\n`;
    const needle2 = headers.startsWith(`${route}\n`) ? `${route}\n` : null;
    let idx = headers.indexOf(needle1);
    if (idx < 0 && needle2) idx = 0;
    else if (idx >= 0) idx += 1;
    expect(idx, `missing rule block for ${route} in public/_headers`).toBeGreaterThanOrEqual(0);
    const block = headers.slice(idx, idx + 800);
    expect(block.toLowerCase()).toContain("x-robots-tag: all");
    expect(block.toLowerCase()).not.toMatch(/x-robots-tag:\s*noindex/);
  });
});

describe("sitemap.xml — developer & docs URLs are listed", () => {
  const sm = read("public/sitemap.xml");
  it.each([
    "https://kangopenbanking.com/developer",
    "https://kangopenbanking.com/developer/api/issuing",
  ])("includes %s", (u) => {
    expect(sm).toContain(u);
  });
});

describe("llms.txt — AI-crawler index advertises Issuing", () => {
  const llms = read("public/llms.txt");
  it("links the Issuing reference page", () => {
    expect(llms).toContain("/developer/api/issuing");
  });
});

describe("App.tsx — /developer/* must NOT be auth-gated (Order P1)", () => {
  const app = read("src/App.tsx");

  it("contains the PERMANENT PUBLIC ROUTES marker", () => {
    expect(app).toMatch(/PERMANENT PUBLIC ROUTES/i);
  });

  it("never wraps a public /developer route in an auth guard", () => {
    // ONLY guard the public docs surface at /developer (and /developer/...).
    // /developer-tools and /developer-portal-admin are intentionally
    // authenticated consoles for logged-in developers and are out of scope.
    // Admin-only operational routes are explicitly allowed exceptions.
    const ADMIN_ONLY_DEV_PATHS = ["/developer/deployment-status", "/developer/env-vars"];
    const lines = app.split("\n");
    const offenders: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      const isPublicDeveloperPath =
        /path=["']\/developer(\/[^"']*)?["']/.test(l) ||
        /<Route\s+path=["']developer["']/.test(l);
      if (!isPublicDeveloperPath) continue;
      const pathMatch = l.match(/path=["'](\/developer\/[^"']*)["']/);
      const fullPath = pathMatch ? pathMatch[1] : "";
      if (ADMIN_ONLY_DEV_PATHS.includes(fullPath)) continue;
      const window = lines.slice(i, i + 3).join(" ");
      if (/element=\{<\s*(ProtectedRoute|RequireAuth|AuthGuard|RoleGuard|RequireRole|RequireAdmin)/.test(window)) {
        offenders.push(`L${i + 1}: ${l.trim()}`);
      }
    }
    expect(offenders, `Auth-gated public /developer routes detected:\n${offenders.join("\n")}`).toHaveLength(0);
  });

  it("never redirects from /developer to /auth", () => {
    // Catch <Navigate to="/auth" /> placed inside a developer route element.
    expect(app).not.toMatch(/path=["']\/?developer[^"']*["'][^>]*element=\{<Navigate\s+to=["']\/auth/);
  });
});

describe("Admin-only operational pages are hidden from crawlers", () => {
  const robots = read("public/robots.txt");
  const headers = read("public/_headers");

  it.each([
    "/developer/deployment-status",
    "/developer/env-vars",
  ])("robots.txt Disallows %s", (p) => {
    expect(robots).toContain(`Disallow: ${p}`);
  });

  it.each([
    "/developer/deployment-status",
    "/developer/env-vars",
  ])("_headers declares x-robots-tag: noindex for %s", (route) => {
    const needle = `\n${route}\n`;
    let idx = headers.indexOf(needle);
    expect(idx, `missing rule block for ${route} in public/_headers`).toBeGreaterThanOrEqual(0);
    idx += 1; // move past the leading newline
    const block = headers.slice(idx, idx + 400);
    expect(block.toLowerCase()).toContain("x-robots-tag: noindex");
  });
});

describe("Public spec files exist and are valid", () => {
  it.each(PUBLIC_DOC_PATHS)("%s exists in public/", (p) => {
    const fp = path.join(root, "public", p.replace(/^\//, ""));
    expect(fs.existsSync(fp), `${fp} missing`).toBe(true);
    expect(fs.statSync(fp).size).toBeGreaterThan(50);
  });
});
