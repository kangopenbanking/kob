// Source-guard for developer-portal discoverability.
// Asserts every operational reliability route is present in BOTH:
//   - public/sitemap.xml (search engine discovery)
//   - public/llms.txt    (AI crawler discovery — GPTBot, ClaudeBot, etc.)
// AND linked from the BuildReliablySection so a crawler reaching /developer
// can follow them without parsing the sitemap.
//
// Standing Order P2 (Zero-404) + Order P8 (Search) require these to surface.
// If you intentionally remove a route, also remove the entry from the lists below.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const sitemap = readFileSync(resolve(ROOT, "public/sitemap.xml"), "utf8");
const llms = readFileSync(resolve(ROOT, "public/llms.txt"), "utf8");
const buildReliably = readFileSync(
  resolve(ROOT, "src/components/developer/landing/BuildReliablySection.tsx"),
  "utf8"
);
const robots = readFileSync(resolve(ROOT, "public/robots.txt"), "utf8");
const apisJson = readFileSync(resolve(ROOT, "public/apis.json"), "utf8");

const REQUIRED_OPS_ROUTES = [
  "/developer/guides/sdks",
  "/developer/guides/postman",
  "/developer/api-reference/rate-limits",
  "/developer/api-reference/idempotency",
  "/developer/api-reference/pagination",
  "/developer/api-reference/webhook-retry",
  "/developer/api-reference/token-lifecycle",
  "/developer/api-reference/payment-lifecycle",
  "/developer/api-reference/charge-states",
  "/developer/api-reference/payout-states",
  "/developer/api-reference/dispute-lifecycle",
  "/developer/idempotency-playground",
  "/developer/standards",
];

describe("Developer portal discoverability — operational reliability surface", () => {
  it.each(REQUIRED_OPS_ROUTES)(
    "%s is listed in public/sitemap.xml",
    (route) => {
      expect(sitemap).toContain(`https://kangopenbanking.com${route}`);
    }
  );

  it.each(REQUIRED_OPS_ROUTES)(
    "%s is listed in public/llms.txt for AI crawlers",
    (route) => {
      expect(llms).toContain(route);
    }
  );

  // BuildReliablySection links every reliability route except the deeper
  // /developer/guides/pagination-examples (covered separately by sitemap +
  // pagination card). All eight cards above are required.
  it.each(REQUIRED_OPS_ROUTES)(
    "%s is linked from BuildReliablySection on /developer landing",
    (route) => {
      expect(buildReliably).toContain(`"${route}"`);
    }
  );

  it("robots.txt advertises llms.txt for AI crawlers", () => {
    expect(robots).toContain("llms.txt");
    expect(robots).toContain("Sitemap: https://kangopenbanking.com/sitemap.xml");
  });

  it("apis.json exposes SDK package registry URLs (npm, PyPI, Packagist, pkg.go.dev)", () => {
    expect(apisJson).toContain("npmjs.com/package/@kangopenbanking/sdk");
    expect(apisJson).toContain("pypi.org/project/kangopenbanking");
    expect(apisJson).toContain("packagist.org/packages/kangopenbanking/sdk");
    expect(apisJson).toContain("pkg.go.dev/github.com/kangopenbanking/sdk-go");
  });

  it("apis.json exposes operational guide URLs for AI agents", () => {
    expect(apisJson).toContain("X-rate-limits");
    expect(apisJson).toContain("X-idempotency");
    expect(apisJson).toContain("X-pagination");
    expect(apisJson).toContain("X-webhook-retry");
    expect(apisJson).toContain("X-token-lifecycle");
    expect(apisJson).toContain("X-llms-txt");
  });
});
