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
 *     (ProtectedRoute / RequireAuth / AuthGuard).
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
  it("never declares Disallow on /developer or /openapi", () => {
    expect(robots).not.toMatch(/Disallow:\s*\/developer/);
    expect(robots).not.toMatch(/Disallow:\s*\/openapi/);
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
    const lines = app.split("\n");
    const offenders: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      const isPublicDeveloperPath =
        /path=["']\/developer(\/[^"']*)?["']/.test(l) ||
        /<Route\s+path=["']developer["']/.test(l);
      if (!isPublicDeveloperPath) continue;
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

describe("Public spec files exist and are valid", () => {
  it.each(PUBLIC_DOC_PATHS)("%s exists in public/", (p) => {
    const fp = path.join(root, "public", p.replace(/^\//, ""));
    expect(fs.existsSync(fp), `${fp} missing`).toBe(true);
    expect(fs.statSync(fp).size).toBeGreaterThan(50);
  });
});
