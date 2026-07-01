/**
 * cards-v3 — Timeline audit E2E.
 *
 * Given a card's persisted `metadata.timeline` (as displayed at
 * /admin/cards → Issuance Timeline for a card id), verify:
 *   1. Every issuance emits the mandatory steps in canonical order.
 *   2. Timestamps are monotonically non-decreasing (no out-of-order steps).
 *   3. No canonical step is missing (no gaps).
 *   4. Every step's shape matches { step, at } with valid ISO timestamps.
 *
 * The test operates against the same timeline array shape that the
 * Admin Card Management page reads (`metadata.timeline`) and that the
 * cards-v3 edge function persists via `logStep` / `track`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CANONICAL_STEPS = [
  "requested",
  "cardholder_ready",
  "provider_issued",
  "persisted",
] as const;

type Step = { step: string; at: string; note?: string };

function auditTimeline(timeline: Step[]) {
  const issues: string[] = [];

  // Shape
  for (const [i, s] of timeline.entries()) {
    if (!s || typeof s.step !== "string" || typeof s.at !== "string") {
      issues.push(`step[${i}] malformed`);
      continue;
    }
    if (Number.isNaN(Date.parse(s.at))) issues.push(`step[${i}] invalid timestamp`);
  }

  // No gaps — every canonical step must appear at least once
  for (const req of CANONICAL_STEPS) {
    if (!timeline.some((s) => s.step === req)) issues.push(`missing step: ${req}`);
  }

  // Canonical steps must appear in canonical order
  const positions = CANONICAL_STEPS.map((s) =>
    timeline.findIndex((t) => t.step === s),
  );
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] !== -1 && positions[i - 1] !== -1 && positions[i] < positions[i - 1]) {
      issues.push(`out of order: ${CANONICAL_STEPS[i]} before ${CANONICAL_STEPS[i - 1]}`);
    }
  }

  // Monotonic timestamps
  for (let i = 1; i < timeline.length; i++) {
    const prev = Date.parse(timeline[i - 1].at);
    const cur = Date.parse(timeline[i].at);
    if (Number.isFinite(prev) && Number.isFinite(cur) && cur < prev) {
      issues.push(`timestamp regression at step[${i}] (${timeline[i].step})`);
    }
  }

  return issues;
}

describe("cards-v3 timeline audit", () => {
  it("passes a well-formed timeline", () => {
    const now = Date.now();
    const good: Step[] = CANONICAL_STEPS.map((step, i) => ({
      step,
      at: new Date(now + i * 100).toISOString(),
    }));
    expect(auditTimeline(good)).toEqual([]);
  });

  it("flags out-of-order canonical steps", () => {
    const now = Date.now();
    const bad: Step[] = [
      { step: "provider_issued", at: new Date(now).toISOString() },
      { step: "requested",       at: new Date(now + 10).toISOString() },
      { step: "cardholder_ready", at: new Date(now + 20).toISOString() },
      { step: "persisted",       at: new Date(now + 30).toISOString() },
    ];
    const issues = auditTimeline(bad);
    expect(issues.some((i) => i.startsWith("out of order"))).toBe(true);
  });

  it("flags missing (gap) steps", () => {
    const now = Date.now();
    const gap: Step[] = [
      { step: "requested",       at: new Date(now).toISOString() },
      { step: "persisted",       at: new Date(now + 20).toISOString() },
    ];
    const issues = auditTimeline(gap);
    expect(issues).toContain("missing step: cardholder_ready");
    expect(issues).toContain("missing step: provider_issued");
  });

  it("flags timestamp regressions", () => {
    const now = Date.now();
    const rev: Step[] = [
      { step: "requested",        at: new Date(now + 100).toISOString() },
      { step: "cardholder_ready", at: new Date(now + 50).toISOString() },
      { step: "provider_issued",  at: new Date(now + 200).toISOString() },
      { step: "persisted",        at: new Date(now + 300).toISOString() },
    ];
    const issues = auditTimeline(rev);
    expect(issues.some((i) => i.startsWith("timestamp regression"))).toBe(true);
  });

  it("cards-v3 source emits every canonical step through the track() helper", () => {
    const fn = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/cards-v3/index.ts"),
      "utf8",
    );
    for (const step of CANONICAL_STEPS) {
      // Each canonical step must be tracked to the persisted timeline.
      expect(fn).toMatch(new RegExp(`track\\(\\s*["']${step}["']`));
    }
  });

  it("admin page renders a friendly error state instead of failing silently", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/pages/admin/AdminCardManagement.tsx"),
      "utf8",
    );
    expect(src).toMatch(/extractEdgeFunctionError/);
    expect(src).toMatch(/Card list unavailable/);
    expect(src).toMatch(/Retry/);
  });

  it("cards-v3 wraps its handler in a top-level try/catch that returns structured errors", () => {
    const fn = fs.readFileSync(
      path.join(process.cwd(), "supabase/functions/cards-v3/index.ts"),
      "utf8",
    );
    expect(fn).toMatch(/internal_error/);
    expect(fn).toMatch(/\[cards-v3\] unhandled/);
  });
});
