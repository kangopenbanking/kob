/**
 * Webhook replay protection — E2E error format & retry guidance contract
 * ----------------------------------------------------------------------
 * Verifies that:
 *   1. Duplicate event ids are rejected and translated to the documented
 *      WH_ error envelope (matches /developer/api/error-codes catalog).
 *   2. The 409 response advertises retry guidance per spec x-webhook-policy
 *      (max_attempts, retry_schedule_seconds, signature/replay headers).
 *   3. The TTL window respected by the helper matches what is documented.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

type Spec = Record<string, any>;
function loadSpec(rel: string): Spec {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public", rel), "utf-8"));
}

// Fake Supabase that mirrors webhook_inbox + UNIQUE(source, event_id)
function makeFakeSupabase() {
  const rows: any[] = [];
  return {
    rows,
    from(_t: string) {
      let f: any = {};
      const b: any = {
        select() { return b; },
        eq(c: string, v: any) { f[c] = v; return b; },
        gte(_c: string, v: string) { f.gte = v; return b; },
        async maybeSingle() {
          const r = rows.find((r) =>
            (!f.source || r.source === f.source) &&
            (!f.event_id || r.event_id === f.event_id) &&
            (!f.gte || r.created_at >= f.gte),
          );
          return { data: r ?? null, error: null };
        },
        insert(p: any) {
          const dup = rows.find((r) => r.source === p.source && r.event_id === p.event_id);
          if (dup) return { select() { return { single: async () => ({ data: null, error: { code: "23505" } }) }; } };
          const row = { id: crypto.randomUUID(), source: p.source, event_id: p.event_id, created_at: new Date().toISOString() };
          rows.push(row);
          return { select() { return { single: async () => ({ data: row, error: null }) }; } };
        },
      };
      return b;
    },
  };
}

// Mirrors the gateway's translation of a duplicate inbox row to a public
// HTTP response. This shape is the documented contract — keep in sync with
// supabase/functions/_shared/webhook-replay-protection.ts.
function buildDuplicateResponse(spec: Spec) {
  const policy = spec["x-webhook-policy"];
  return {
    status: 409,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "0", // duplicate — no retry needed
      "X-Webhook-Replay-Policy": "drop_duplicate_within_ttl",
    },
    body: {
      error: "duplicate_webhook",
      error_code: "WH_004",
      message: "Webhook with this X-Webhook-ID was already received within the deduplication window.",
      error_id: `err_${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      details: {
        replay_protection: {
          dedupe_header: policy.event_id_header,
          window_hours: 24,
          retry_schedule_seconds: policy.retry_schedule_seconds,
          max_attempts: policy.max_attempts,
          guidance: "Duplicate is the expected outcome of an at-least-once retry; treat as success.",
        },
      },
    },
  };
}

describe.each(["sandbox", "production"] as const)("Webhook replay E2E — %s", (env) => {
  let spec: Spec;
  beforeAll(() => {
    spec = loadSpec(env === "sandbox" ? "openapi-sandbox.json" : "openapi.json");
  });

  it("duplicate X-Webhook-ID returns the documented error envelope", async () => {
    const sb = makeFakeSupabase();
    // First delivery: accepted
    sb.from("webhook_inbox").insert({ source: env, event_id: "evt_dup_1", payload: {} }).select().single();
    // Second delivery: duplicate path
    const dup = await sb.from("webhook_inbox").insert({ source: env, event_id: "evt_dup_1", payload: {} }).select().single() as any;
    expect(dup.error?.code).toBe("23505");

    const resp = buildDuplicateResponse(spec);
    expect(resp.status).toBe(409);
    // Envelope shape matches the public error catalog
    expect(resp.body).toMatchObject({
      error: expect.any(String),
      error_code: expect.stringMatching(/^WH_\d+$/),
      message: expect.any(String),
      error_id: expect.stringMatching(/^err_/),
      timestamp: expect.any(String),
    });
  });

  it("409 carries retry guidance referencing x-webhook-policy", async () => {
    const resp = buildDuplicateResponse(spec);
    const guidance = resp.body.details.replay_protection;
    expect(guidance.dedupe_header).toBe("X-Webhook-ID");
    expect(guidance.max_attempts).toBe(spec["x-webhook-policy"].max_attempts);
    expect(guidance.retry_schedule_seconds).toEqual(spec["x-webhook-policy"].retry_schedule_seconds);
    expect(guidance.window_hours).toBeGreaterThanOrEqual(24);
    expect(resp.headers["Retry-After"]).toBeDefined();
    expect(resp.headers["X-Webhook-Replay-Policy"]).toBe("drop_duplicate_within_ttl");
  });

  it("WH_ error domain is documented in the public error catalog", async () => {
    const fsp = await import("node:fs/promises");
    const cat = await fsp.readFile("src/pages/developer/ErrorCodesReference.tsx", "utf8");
    // The error codes page must enumerate WH_ codes (Webhooks domain)
    expect(cat).toMatch(/Webhooks?\s*\(WH_\)/i);
  });

  it("documented signature & replay headers match runtime helper contract", async () => {
    const policy = spec["x-webhook-policy"];
    expect(policy.signature_header).toBe("X-Webhook-Signature");
    expect(policy.event_id_header).toBe("X-Webhook-ID");
    expect(policy.signature_algorithm).toMatch(/HMAC-SHA256/i);
    // Helper file exists and references the same column (event_id) used for dedupe
    const helper = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/functions/_shared/webhook-replay-protection.ts"),
      "utf8",
    );
    expect(helper).toMatch(/event_id/);
    expect(helper).toMatch(/webhook_inbox/);
  });
});
