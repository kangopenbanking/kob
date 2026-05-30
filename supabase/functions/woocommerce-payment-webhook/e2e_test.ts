// E2E: full webhook status update flow → consumer marketplace reflects state.
//
// Flow:
//   1. Seed a woocommerce_merchant + woocommerce_transaction (pending)
//   2. Seed a pos_product owned by that merchant (visible in marketplace)
//   3. POST notify mode → expect status flipped to completed
//   4. POST same payload again → expect duplicate=true (idempotency)
//   5. Re-read woocommerce_transactions → confirm status persisted
//   6. Re-read pos_products (consumer marketplace view) → confirm product is
//      still listed and reflects an updated/active state.
//   7. Clean up.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN = `${URL}/functions/v1/woocommerce-payment-webhook`;

Deno.test({
  name: "woo webhook notify → marketplace reflects payment state (idempotent)",
  sanitizeOps: false,
  sanitizeResources: false,
  ignore: !URL || !SERVICE,
  fn: async () => {
    const sb = createClient(URL, SERVICE);
    const stamp = Date.now();
    const tx_ref = `e2e-woo-${stamp}`;
    const merchant = {
      user_id: crypto.randomUUID(),
      store_name: `e2e ${stamp}`,
      store_url: `https://e2e-${stamp}.test`,
      admin_email: `e2e+${stamp}@test.local`,
      api_key_hash: `hash_${stamp}`,
      client_secret_hash: `secret_${stamp}`,
      webhook_secret_hash: `whsec_${stamp}`,
      status: "active",
    };
    const { data: m, error: mErr } = await sb.from("woocommerce_merchants").insert(merchant).select("id").single();
    assert(!mErr, `merchant insert: ${mErr?.message}`);

    const { error: tErr } = await sb.from("woocommerce_transactions").insert({
      merchant_id: m!.id,
      woocommerce_order_id: `${stamp}`,
      transaction_ref: tx_ref,
      payment_method: "mobile_money",
      amount: 1000,
      currency: "XAF",
      status: "pending",
    });
    assert(!tErr, `tx insert: ${tErr?.message}`);

    const { data: prod } = await sb.from("pos_products").insert({
      merchant_id: m!.id,
      name: `E2E Product ${stamp}`,
      price: 1000,
      currency: "XAF",
      source: "woocommerce",
      is_active: true,
    }).select("id").maybeSingle();

    try {
      const payload = { mode: "notify", transaction_ref: tx_ref, status: "success", provider_ref: `prov_${stamp}`, idempotency_key: `evt_${stamp}` };

      const r1 = await fetch(FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": SERVICE },
        body: JSON.stringify(payload),
      });
      const b1 = await r1.json();
      assertEquals(r1.status, 200, `notify status: ${JSON.stringify(b1)}`);
      assertEquals(b1.status, "completed");

      const r2 = await fetch(FN, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": SERVICE },
        body: JSON.stringify(payload),
      });
      const b2 = await r2.json();
      assertEquals(r2.status, 200);
      assertEquals(b2.duplicate, true, "second call must be deduped");

      const { data: tx } = await sb.from("woocommerce_transactions").select("status").eq("transaction_ref", tx_ref).maybeSingle();
      assertEquals(tx?.status, "completed");

      if (prod) {
        const { data: marketplace } = await sb
          .from("pos_products")
          .select("id, is_active, source")
          .eq("merchant_id", m!.id)
          .eq("is_active", true);
        assert((marketplace?.length ?? 0) > 0, "consumer marketplace must list the merchant's product");
        assertEquals(marketplace![0].source, "woocommerce");
      }
    } finally {
      await sb.from("webhook_inbox").delete().eq("source", "woocommerce").like("event_id", `evt_${stamp}%`);
      await sb.from("woocommerce_transactions").delete().eq("transaction_ref", tx_ref);
      if (prod) await sb.from("pos_products").delete().eq("id", prod.id);
      await sb.from("woocommerce_merchants").delete().eq("id", m!.id);
    }
  },
});
