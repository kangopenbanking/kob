/**
 * cards-v3 — E2E contract test (Virtual, Digital, Physical).
 *
 * These are static-source contract checks that guarantee the consumer
 * card issuance surface stays intact across refactors:
 *   - action router handles issue/list/freeze/unfreeze/terminate/update_limits
 *   - idempotency short-circuit is wired via metadata->>idempotency_key
 *   - structured issuance timeline is persisted + emitted
 *   - customer-facing error copy contains no provider brand names
 *   - customer-facing UI files contain no Nium / Kora references
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/cards-v3/index.ts"),
  "utf8",
);

describe("cards-v3 edge function", () => {
  it("routes every consumer action", () => {
    for (const a of ["issue", "list", "freeze", "unfreeze", "terminate", "update_limits"]) {
      expect(fn).toContain(`case "${a}"`);
    }
  });

  it("supports Virtual, Digital, and Physical form factors", () => {
    expect(fn).toMatch(/\["virtual",\s*"digital",\s*"physical"\]/);
  });

  it("enforces idempotency by matching metadata->>idempotency_key", () => {
    expect(fn).toMatch(/metadata->>idempotency_key/);
    expect(fn).toMatch(/idempotent_replay/);
    expect(fn).toMatch(/X-Idempotent-Replay/);
  });

  it("emits a structured status timeline for tracing", () => {
    expect(fn).toMatch(/card_issue_step/);
    for (const step of [
      "requested",
      "cardholder_ready",
      "provider_issued",
      "persisted",
    ]) {
      expect(fn).toContain(`"${step}"`);
    }
  });

  it("returns consumer-safe error copy (no provider brand names)", () => {
    // Grab all `err(` messages
    const errs = [...fn.matchAll(/err\("[^"]+",\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(errs.length).toBeGreaterThan(0);
    for (const msg of errs) {
      expect(msg.toLowerCase()).not.toContain("nium");
      expect(msg.toLowerCase()).not.toContain("kora");
    }
  });

  it("requires a full shipping address for Physical cards", () => {
    expect(fn).toMatch(/full shipping address is required/i);
  });
});

describe("Customer Cards UI — no provider branding", () => {
  const files = [
    "src/pages/customer-app/CustomerCards.tsx",
    "src/pages/customer-app/CustomerCardOrderPhysical.tsx",
    "src/pages/customer-app/CustomerCardSettings.tsx",
  ];

  for (const f of files) {
    it(`${f} has no user-visible Nium / Kora mentions`, () => {
      const p = path.join(root, f);
      if (!fs.existsSync(p)) return;
      const src = fs.readFileSync(p, "utf8");
      expect(src.toLowerCase()).not.toContain("nium");
      expect(src.toLowerCase()).not.toContain("kora");
    });
  }
});

describe("Customer Cards UI — resilience UX", () => {
  const cards = fs.readFileSync(
    path.join(root, "src/pages/customer-app/CustomerCards.tsx"),
    "utf8",
  );
  const physical = fs.readFileSync(
    path.join(root, "src/pages/customer-app/CustomerCardOrderPhysical.tsx"),
    "utf8",
  );

  it("preserves the idempotency key on retry (CustomerCards)", () => {
    expect(cards).toMatch(/issueAttemptKeys/);
    expect(cards).toMatch(/action:\s*\{\s*label:\s*'Retry'/);
  });

  it("preserves the idempotency key on retry (Physical order)", () => {
    expect(physical).toMatch(/idemKey/);
    expect(physical).toMatch(/action:\s*\{\s*label:\s*'Retry'/);
  });

  it("renders the issuance timeline", () => {
    expect(cards).toMatch(/Last issuance timeline/);
  });
});
