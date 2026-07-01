// E2E: nium-webhook signature verification + replay protection
// Requires NIUM_WEBHOOK_SECRET set in the target environment (already stored).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BASE = Deno.env.get("VITE_SUPABASE_URL") ?? "https://wdzkzeahdtxlynetndqw.supabase.co";
const SECRET = Deno.env.get("NIUM_WEBHOOK_SECRET") ?? "";
const URL = `${BASE}/functions/v1/nium-webhook`;

const post = (body: unknown, headers: Record<string, string>) =>
  fetch(URL, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("nium-webhook: rejects request with no signature", async () => {
  const res = await post({ eventType: "payment_incoming", transactionId: "no_sig_1" }, {});
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("nium-webhook: rejects wrong x-nium-signature-key", async () => {
  const res = await post(
    { eventType: "payment_incoming", transactionId: "wrong_key_1" },
    { "x-nium-signature-key": "definitely-not-the-secret" },
  );
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("nium-webhook: rejects wrong HMAC x-nium-signature", async () => {
  const body = { eventType: "payment_incoming", transactionId: "wrong_hmac_1" };
  const res = await post(body, { "x-nium-signature": "deadbeef".repeat(8) });
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("nium-webhook: accepts valid x-nium-signature-key", async () => {
  if (!SECRET) return;
  const id = `e2e_key_${Date.now()}`;
  const res = await post(
    { eventType: "unknown_event_for_test", eventId: id },
    { "x-nium-signature-key": SECRET },
  );
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("nium-webhook: accepts valid HMAC and blocks replay", async () => {
  if (!SECRET) return;
  const id = `e2e_hmac_${Date.now()}`;
  const payload = { eventType: "unknown_event_for_test", eventId: id };
  const raw = JSON.stringify(payload);
  const sig = await hmacHex(SECRET, raw);

  // First delivery — accepted
  const r1 = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-nium-signature": sig },
    body: raw,
  });
  assertEquals(r1.status, 200);
  const j1 = await r1.json();
  assertEquals(j1.duplicate ?? false, false);

  // Second delivery, same event_id — deduped (still 200)
  const r2 = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-nium-signature": sig },
    body: raw,
  });
  assertEquals(r2.status, 200);
  const j2 = await r2.json();
  assertEquals(j2.duplicate, true);
});
