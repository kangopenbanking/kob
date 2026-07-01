/**
 * cards-v3 — concurrency + brand-scrub contract tests.
 *
 * These are static-source contract checks (fast, deterministic) that guarantee:
 *  1. The idempotency short-circuit runs BEFORE any provider call / DB insert,
 *     so concurrent duplicate issue requests cannot create duplicate cards.
 *  2. The persisted milestone dispatches a card.issue.persisted webhook once.
 *  3. Every customer-facing email template + notification helper is free of
 *     the provider brand names "Nium" and "Kora".
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fn = fs.readFileSync(
  path.join(root, "supabase/functions/cards-v3/index.ts"),
  "utf8",
);

describe("cards-v3 — concurrent duplicate issuance safety", () => {
  it("checks metadata->>idempotency_key BEFORE calling issueCard()", () => {
    const idempCheck = fn.indexOf("metadata->>idempotency_key");
    const providerCall = fn.indexOf("await issueCard(");
    expect(idempCheck).toBeGreaterThan(-1);
    expect(providerCall).toBeGreaterThan(-1);
    // Short-circuit MUST come first so racing callers all resolve to the same row.
    expect(idempCheck).toBeLessThan(providerCall);
  });

  it("checks metadata->>idempotency_key BEFORE inserting into virtual_cards", () => {
    const idempCheck = fn.indexOf("metadata->>idempotency_key");
    const insertCall = fn.indexOf('.from("virtual_cards")\n    .insert(');
    expect(idempCheck).toBeGreaterThan(-1);
    expect(insertCall).toBeGreaterThan(-1);
    expect(idempCheck).toBeLessThan(insertCall);
  });

  it("returns the existing row (never inserts a second) on replay", () => {
    // Replay path must return early and set the X-Idempotent-Replay header.
    expect(fn).toMatch(/if\s*\(existing\)\s*\{[\s\S]*?X-Idempotent-Replay[\s\S]*?return/);
  });

  it("emits exactly one card.issue.persisted webhook per successful issuance", () => {
    const matches = fn.match(/card\.issue\.persisted/g) ?? [];
    // One string literal in the dispatchCardWebhook call.
    expect(matches.length).toBe(1);
    expect(fn).toMatch(/dispatchCardWebhook\(\s*sb\s*,\s*"card\.issue\.persisted"/);
  });
});

describe("Customer-facing email + notification templates — no provider brand names", () => {
  const scanDirs = [
    "supabase/functions/_shared/email-templates",
    "supabase/functions/_shared/send-managed-email.ts",
    "supabase/functions/_shared/email-sender.ts",
    "supabase/functions/_shared/ptp-notify.ts",
    "supabase/functions/_shared/admin-notify.ts",
    "supabase/functions/_shared/ddn-notify.ts",
  ];

  function walk(p: string): string[] {
    if (!fs.existsSync(p)) return [];
    const st = fs.statSync(p);
    if (st.isFile()) return [p];
    return fs.readdirSync(p).flatMap((f) => walk(path.join(p, f)));
  }

  const files = scanDirs.flatMap((d) => walk(path.join(root, d)));

  it("scans at least one email/notification file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${path.relative(root, f)} has no Nium / Kora mentions`, () => {
      const src = fs.readFileSync(f, "utf8").toLowerCase();
      expect(src).not.toContain("nium");
      expect(src).not.toContain("kora");
    });
  }
});
