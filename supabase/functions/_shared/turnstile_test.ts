// Deno test for the hardened Turnstile verifier and enforce-mode gate.
//
// Run:  deno test --allow-env --allow-net supabase/functions/_shared/turnstile_test.ts
//
// We stub `fetch` so the suite never hits Cloudflare. Each case asserts the
// exact contract the edge functions rely on:
//   - enforce off + token absent → ok=true (shadow) so signups never break
//   - enforce on  + token absent → ok=false, reason='missing_token'
//   - enforce on  + token invalid → ok=false, reason from cf 'error-codes'
//   - enforce on  + token valid + hostname allowlisted → ok=true
//   - enforce on  + hostname not in allowlist → ok=false, reason='hostname_not_allowlisted'
//   - enforce on  + challenge_ts too old → ok=false, reason='replay_window_exceeded'
//   - enforce on  + action mismatch → ok=false, reason='action_mismatch'
//   - cf 5xx → fail-open ok=true, reason='cf_5xx_failopen'

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyTurnstile, turnstileEnforceEnabled } from "./turnstile.ts";

const originalFetch = globalThis.fetch;

function stubFetch(response: Response) {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).fetch = (..._args: any[]) => Promise.resolve(response);
}
function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function setEnv(env: Record<string, string | null>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

const BASE_ENV = {
  TURNSTILE_SECRET_KEY: "test-secret",
  TURNSTILE_ENFORCE: "true",
  TURNSTILE_ALLOWED_HOSTNAMES: "kob.lovable.app,kangopenbanking.com",
  TURNSTILE_MAX_AGE_S: "120",
};

Deno.test("shadow mode (enforce off + token absent) → ok=true", async () => {
  setEnv({ ...BASE_ENV, TURNSTILE_ENFORCE: "false" });
  assertEquals(turnstileEnforceEnabled(), false);
  const r = await verifyTurnstile(null, null);
  // Backend still computes ok=false for missing token but caller does not block
  assertEquals(r.shadow, true);
});

Deno.test("enforce + missing token → ok=false reason=missing_token", async () => {
  setEnv(BASE_ENV);
  const r = await verifyTurnstile(null, null);
  assertEquals(r.ok, false);
  assertEquals(r.reason, "missing_token");
});

Deno.test("enforce + cf success + hostname allowed → ok=true", async () => {
  setEnv(BASE_ENV);
  stubFetch(new Response(JSON.stringify({
    success: true,
    hostname: "kob.lovable.app",
    challenge_ts: new Date().toISOString(),
    action: "developer_register",
    "error-codes": [],
  }), { status: 200 }));
  const r = await verifyTurnstile("tok", null);
  restoreFetch();
  assertEquals(r.ok, true);
  assertEquals(r.reason, "verified");
});

Deno.test("enforce + hostname not allowlisted → ok=false", async () => {
  setEnv(BASE_ENV);
  stubFetch(new Response(JSON.stringify({
    success: true,
    hostname: "evil.example.com",
    challenge_ts: new Date().toISOString(),
    "error-codes": [],
  }), { status: 200 }));
  const r = await verifyTurnstile("tok", null);
  restoreFetch();
  assertEquals(r.ok, false);
  assertEquals(r.reason, "hostname_not_allowlisted");
  assert(r.codes.includes("hostname-not-allowed"));
});

Deno.test("enforce + replay window exceeded → ok=false", async () => {
  setEnv({ ...BASE_ENV, TURNSTILE_MAX_AGE_S: "30" });
  stubFetch(new Response(JSON.stringify({
    success: true,
    hostname: "kob.lovable.app",
    challenge_ts: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    "error-codes": [],
  }), { status: 200 }));
  const r = await verifyTurnstile("tok", null);
  restoreFetch();
  assertEquals(r.ok, false);
  assertEquals(r.reason, "replay_window_exceeded");
});

Deno.test("enforce + action mismatch → ok=false", async () => {
  setEnv(BASE_ENV);
  stubFetch(new Response(JSON.stringify({
    success: true,
    hostname: "kob.lovable.app",
    challenge_ts: new Date().toISOString(),
    action: "wrong",
    "error-codes": [],
  }), { status: 200 }));
  const r = await verifyTurnstile("tok", null, { expectedAction: "developer_register" });
  restoreFetch();
  assertEquals(r.ok, false);
  assertEquals(r.reason, "action_mismatch");
});

Deno.test("enforce + cf failure → ok=false reason from error-codes", async () => {
  setEnv(BASE_ENV);
  stubFetch(new Response(JSON.stringify({
    success: false,
    "error-codes": ["invalid-input-response"],
  }), { status: 200 }));
  const r = await verifyTurnstile("tok", null);
  restoreFetch();
  assertEquals(r.ok, false);
  assertEquals(r.reason, "invalid-input-response");
});

Deno.test("enforce + cf 5xx → fail-open ok=true", async () => {
  setEnv(BASE_ENV);
  stubFetch(new Response("upstream", { status: 503 }));
  const r = await verifyTurnstile("tok", null);
  restoreFetch();
  assertEquals(r.ok, true);
  assertEquals(r.reason, "cf_5xx_failopen");
});

Deno.test("secret unset → fail-open regardless of enforce", async () => {
  setEnv({ ...BASE_ENV, TURNSTILE_SECRET_KEY: null });
  const r = await verifyTurnstile(null, null);
  assertEquals(r.ok, true);
  assertEquals(r.reason, "secret_unset_failopen");
});
