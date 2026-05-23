// Saving Vault operations: balance, transactions, withdraw to wallet/bank (free).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/vault-ops/, "").replace(/\/+$/, "") || "/";
    const method = req.method;

    async function ensureVault() {
      const { data } = await sb.from("savings_vaults")
        .select("*").eq("consumer_id", user.id).maybeSingle();
      if (data) return data;
      const { data: created, error } = await sb.from("savings_vaults")
        .insert({ consumer_id: user.id, balance: 0 })
        .select().single();
      if (error) throw error;
      return created;
    }

    if (method === "GET" && path === "/balance") {
      const v = await ensureVault();
      return json({ balance: Number(v.balance), currency: v.currency });
    }

    if (method === "GET" && path === "/transactions") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
      const { data, error } = await sb.from("vault_transactions")
        .select("*").eq("consumer_id", user.id)
        .order("created_at", { ascending: false }).limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json({ transactions: data ?? [] });
    }

    if (method === "POST" && path === "/withdraw") {
      const body = await req.json().catch(() => ({}));
      const amount = Number(body.amount);
      const destinationKind = String(body.destination_kind ?? "");
      const destinationAccountId = body.destination_account_id ? String(body.destination_account_id) : null;
      const idem = String(body.idempotency_key ?? crypto.randomUUID());

      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "invalid_amount" }, 400);
      if (!["wallet", "bank"].includes(destinationKind)) return json({ error: "invalid_destination_kind" }, 400);
      if (!destinationAccountId) return json({ error: "destination_account_required" }, 400);

      // Verify destination account belongs to user
      const { data: acct } = await sb.from("accounts")
        .select("id, user_id, currency")
        .eq("id", destinationAccountId).maybeSingle();
      if (!acct || acct.user_id !== user.id) return json({ error: "destination_not_owned" }, 403);

      // Idempotency
      const { data: prior } = await sb.from("vault_transactions")
        .select("*").eq("idempotency_key", idem).maybeSingle();
      if (prior) return json({ transaction: prior, replayed: true });

      const vault = await ensureVault();
      const current = Number(vault.balance);
      if (amount > current) return json({ error: "insufficient_vault_balance", balance: current }, 400);

      const newBal = current - amount;

      // Debit vault
      const { error: updErr } = await sb.from("savings_vaults")
        .update({ balance: newBal }).eq("consumer_id", user.id);
      if (updErr) return json({ error: updErr.message }, 500);

      // Credit destination account_balances (InterimAvailable)
      const { data: bal } = await sb.from("account_balances")
        .select("amount").eq("account_id", destinationAccountId)
        .eq("balance_type", "InterimAvailable").maybeSingle();
      const newDestBal = Number(bal?.amount ?? 0) + amount;
      await sb.from("account_balances").upsert({
        account_id: destinationAccountId,
        balance_type: "InterimAvailable",
        credit_debit_indicator: "Credit",
        amount: newDestBal,
        currency: acct.currency || vault.currency || "XAF",
        balance_datetime: new Date().toISOString(),
      }, { onConflict: "account_id,balance_type" });

      const { data: tx, error: txErr } = await sb.from("vault_transactions").insert({
        consumer_id: user.id,
        kind: "debit",
        amount,
        balance_after: newBal,
        source: "withdrawal",
        destination_kind: destinationKind,
        destination_account_id: destinationAccountId,
        description: `Withdrawal to ${destinationKind}`,
        idempotency_key: idem,
      }).select().single();
      if (txErr) return json({ error: txErr.message }, 500);

      return json({ transaction: tx, new_balance: newBal });
    }

    return json({ error: "not_found", path }, 404);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
