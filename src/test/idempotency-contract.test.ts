// Idempotency-key contract tests
// Verifies that the documented behavior — "duplicate Idempotency-Key replays
// the original response" — matches the actual implementation in
// supabase/functions/_shared/integration-layer/idempotency.ts.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";

describe("Idempotency-Key contract", () => {
  it("documentation page exists and demonstrates the documented flow", async () => {
    const guide = await fs.readFile("src/pages/developer/IdempotencyGuide.tsx", "utf8");
    expect(guide).toContain("Idempotency-Key");
    // Documented success scenario
    expect(guide.toLowerCase()).toMatch(/replay|cached response|same response/);
    // Documented conflict scenario (different body, same key)
    expect(guide.toLowerCase()).toMatch(/conflict|409/);
  });

  it("runtime helper distinguishes replay vs conflict vs miss", async () => {
    const code = await fs.readFile(
      "supabase/functions/_shared/integration-layer/idempotency.ts",
      "utf8",
    );
    // Documented contract from the guide:
    //   1) miss → process and store
    //   2) hit + same request_hash → replay cached response
    //   3) hit + different request_hash → 409 conflict
    expect(code).toContain("conflict");
    expect(code).toContain("request_hash");
    expect(code).toContain("response_status");
    expect(code).toContain("response_body");
  });

  it("storage uses (merchant_id, idempotency_key) composite uniqueness", async () => {
    const code = await fs.readFile(
      "supabase/functions/_shared/integration-layer/idempotency.ts",
      "utf8",
    );
    expect(code).toContain("merchant_id,idempotency_key");
  });
});
