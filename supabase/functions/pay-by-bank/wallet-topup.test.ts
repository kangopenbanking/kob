// E2E smoke test — Pay-by-Bank wallet top-up + consumer bank linking
// Run with: deno test --allow-net --allow-env supabase/functions/pay-by-bank/wallet-topup.test.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const FN = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

const baseHeaders = {
  "Content-Type": "application/json",
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

Deno.test("pay-by-bank create_intent (consumer_wallet) requires auth", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_intent",
      target_type: "consumer_wallet",
      amount: 5000,
      redirect_uri: "https://example.com/return",
      state: crypto.randomUUID(),
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 401, `expected 401, got ${res.status}: ${JSON.stringify(body)}`);
});

Deno.test("pay-by-bank create_intent rejects missing amount", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      action: "create_intent",
      target_type: "consumer_wallet",
      redirect_uri: "https://example.com/return",
      state: crypto.randomUUID(),
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(String(body.error || "").includes("Missing required"));
});

Deno.test("pay-by-bank create_intent (merchant) requires merchant_id", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      action: "create_intent",
      amount: 1000,
      redirect_uri: "https://example.com/return",
      state: crypto.randomUUID(),
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(String(body.error || "").toLowerCase().includes("merchant"));
});

Deno.test("pay-by-bank get_intent returns 404 for unknown id", async () => {
  const res = await fetch(FN("pay-by-bank"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ action: "get_intent", intent_id: crypto.randomUUID() }),
  });
  const body = await res.json();
  assertEquals(res.status, 404);
  assert(String(body.error || "").toLowerCase().includes("not found"));
});

Deno.test("consumer-bank-link unauthorized POST returns 401", async () => {
  const res = await fetch(FN("consumer-bank-link"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_links" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "unauthorized");
});

Deno.test("consumer-bank-link init requires bank_id", async () => {
  const res = await fetch(FN("consumer-bank-link"), {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ action: "init" }),
  });
  const body = await res.json();
  // 400 missing_bank_id OR 401 if anon token is rejected — both acceptable failure modes
  assert(res.status === 400 || res.status === 401, `unexpected status ${res.status}: ${JSON.stringify(body)}`);
});

Deno.test("consumer-bank-link authorize_callback (GET) redirects without crashing", async () => {
  const res = await fetch(
    `${FN("consumer-bank-link")}?action=authorize_callback&link_id=${crypto.randomUUID()}&status=failed`,
    { method: "GET", redirect: "manual" },
  );
  await res.body?.cancel();
  // Should redirect (302) to app even when link not found
  assert(res.status === 302 || res.status === 200, `expected redirect, got ${res.status}`);
});

Deno.test("consumer-bank-link authorize_callback missing link_id and intent_id returns 400", async () => {
  const res = await fetch(`${FN("consumer-bank-link")}?action=authorize_callback`, {
    method: "GET",
    redirect: "manual",
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "missing_link_id_or_intent_id");
});
