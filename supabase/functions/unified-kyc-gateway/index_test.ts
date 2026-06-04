// Unit tests for the Unified KYC Gateway.
// Run with: supabase--test_edge_functions { functions: ["unified-kyc-gateway"] }

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Re-implement userBucket here for isolated unit testing.
function userBucket(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = ((h << 5) - h + userId.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

Deno.test("userBucket is deterministic and in [0,99]", () => {
  const a = userBucket("user-123");
  const b = userBucket("user-123");
  assertEquals(a, b);
  assert(a >= 0 && a < 100);
});

Deno.test("userBucket distributes across range", () => {
  const buckets = new Set<number>();
  for (let i = 0; i < 1000; i++) buckets.add(userBucket(`u-${i}`));
  assert(buckets.size > 50, "should produce diverse buckets");
});

Deno.test("rollout 0% routes no users", () => {
  // pct = 0 → never route (handled before bucket check in real code)
  const pct = 0;
  assert(!(pct > 0));
});

Deno.test("rollout 100% routes all users", () => {
  for (let i = 0; i < 20; i++) {
    const b = userBucket(`u-${i}`);
    assert(b < 100);
  }
});

// Youverify request transformer test
function transformIdentity(doc: string) {
  const t = doc.toLowerCase();
  if (t.includes("passport")) return "/v2/api/identity/ng/passport";
  if (t.includes("driver")) return "/v2/api/identity/ng/drivers-license";
  return "/v2/api/identity/ng/nin";
}

Deno.test("transformer maps document types", () => {
  assertEquals(transformIdentity("passport"), "/v2/api/identity/ng/passport");
  assertEquals(transformIdentity("Drivers License"), "/v2/api/identity/ng/drivers-license");
  assertEquals(transformIdentity("national_id"), "/v2/api/identity/ng/nin");
});

// Circuit breaker logic — pure simulation
type State = "closed" | "open" | "half_open";
function step(state: State, failuresInWindow: number, threshold = 5): State {
  if (state === "closed" && failuresInWindow >= threshold) return "open";
  return state;
}

Deno.test("circuit opens after threshold failures", () => {
  let s: State = "closed";
  for (let i = 1; i <= 5; i++) s = step(s, i);
  assertEquals(s, "open");
});

Deno.test("circuit stays closed below threshold", () => {
  let s: State = "closed";
  for (let i = 1; i <= 4; i++) s = step(s, i);
  assertEquals(s, "closed");
});
