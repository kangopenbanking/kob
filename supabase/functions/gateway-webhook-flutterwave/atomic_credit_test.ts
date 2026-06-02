// E2E tests for F5: atomic_flw_account_credit RPC
// Verifies idempotency and concurrent double-book prevention for a given tx_ref.
//
// Run:  deno test --allow-net --allow-env supabase/functions/gateway-webhook-flutterwave/atomic_credit_test.ts
//
// Requires env: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn(
    "[atomic_credit_test] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — tests will be skipped.",
  );
}

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null;

// Seed a disposable account for the test run.
async function seedAccount(): Promise<string> {
  const { data, error } = await supabase!
    .from("accounts")
    .insert({
      account_holder_name: "F5 Test Account",
      account_type: "checking",
      currency: "XAF",
      account_number: `F5TEST-${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function cleanup(accountId: string, txRef: string) {
  const v_tx_reference = `FLW-CR-${txRef}`;
  await supabase!.from("transactions").delete().eq(
    "transaction_reference",
    v_tx_reference,
  );
  await supabase!.from("account_balances").delete().eq("account_id", accountId);
  await supabase!.from("accounts").delete().eq("id", accountId);
}

Deno.test({
  name: "F5: first call credits, second call with same tx_ref returns duplicate",
  ignore: !supabase,
  fn: async () => {
    const accountId = await seedAccount();
    const txRef = `t-${crypto.randomUUID()}`;
    try {
      const { data: first, error: e1 } = await supabase!.rpc(
        "atomic_flw_account_credit",
        {
          _account_id: accountId,
          _user_id: null,
          _amount: 5000,
          _currency: "XAF",
          _tx_ref: txRef,
          _source: "test_idempotency",
        },
      );
      assertEquals(e1, null);
      assertEquals((first as any).credited, true);
      assertEquals((first as any).status, "credited");

      const { data: second, error: e2 } = await supabase!.rpc(
        "atomic_flw_account_credit",
        {
          _account_id: accountId,
          _user_id: null,
          _amount: 5000,
          _currency: "XAF",
          _tx_ref: txRef,
          _source: "test_idempotency",
        },
      );
      assertEquals(e2, null);
      assertEquals((second as any).credited, false);
      assertEquals((second as any).status, "duplicate");
      assertEquals(
        (first as any).transaction_id,
        (second as any).transaction_id,
        "duplicate must return the original transaction id",
      );

      // Exactly one transaction row exists for this tx_ref.
      const { data: txs } = await supabase!
        .from("transactions")
        .select("id, amount")
        .eq("transaction_reference", `FLW-CR-${txRef}`);
      assertEquals(txs?.length, 1, "only one transaction row may exist");
      assertEquals(Number(txs![0].amount), 5000);

      // Balance was credited exactly once (= 5000, not 10000).
      const { data: bal } = await supabase!
        .from("account_balances")
        .select("amount")
        .eq("account_id", accountId)
        .eq("balance_type", "ClosingAvailable")
        .single();
      assertEquals(Number(bal!.amount), 5000, "balance must equal single credit");
    } finally {
      await cleanup(accountId, txRef);
    }
  },
});

Deno.test({
  name: "F5: concurrent calls with same tx_ref never double-book",
  ignore: !supabase,
  fn: async () => {
    const accountId = await seedAccount();
    const txRef = `t-${crypto.randomUUID()}`;
    try {
      const N = 8;
      const calls = Array.from({ length: N }, () =>
        supabase!.rpc("atomic_flw_account_credit", {
          _account_id: accountId,
          _user_id: null,
          _amount: 2500,
          _currency: "XAF",
          _tx_ref: txRef,
          _source: "test_concurrent",
        }));
      const results = await Promise.all(calls);

      const credited = results.filter((r) =>
        (r.data as any)?.credited === true
      ).length;
      const duplicate = results.filter((r) =>
        (r.data as any)?.status === "duplicate"
      ).length;

      // At most one credit; the rest are duplicates. (Race losers may still
      // see the row from the winner and return duplicate.)
      assert(
        credited <= 1,
        `expected ≤1 successful credit under race, got ${credited}`,
      );
      assertEquals(credited + duplicate, N, "all calls must resolve cleanly");

      const { data: txs } = await supabase!
        .from("transactions")
        .select("id")
        .eq("transaction_reference", `FLW-CR-${txRef}`);
      assertEquals(
        txs?.length,
        1,
        "exactly one transaction row may exist after concurrent storm",
      );

      const { data: bal } = await supabase!
        .from("account_balances")
        .select("amount")
        .eq("account_id", accountId)
        .eq("balance_type", "ClosingAvailable")
        .single();
      assertEquals(
        Number(bal!.amount),
        2500,
        "balance must equal a single credit even under N concurrent calls",
      );
    } finally {
      await cleanup(accountId, txRef);
    }
  },
});

Deno.test({
  name: "F5: invalid input (zero amount) is rejected",
  ignore: !supabase,
  fn: async () => {
    const accountId = await seedAccount();
    const txRef = `t-${crypto.randomUUID()}`;
    try {
      const { error } = await supabase!.rpc("atomic_flw_account_credit", {
        _account_id: accountId,
        _user_id: null,
        _amount: 0,
        _currency: "XAF",
        _tx_ref: txRef,
        _source: "test_invalid",
      });
      assert(error, "zero amount must raise");
      assert(
        String(error!.message).includes("invalid_input"),
        `expected invalid_input error, got: ${error!.message}`,
      );
    } finally {
      await cleanup(accountId, txRef);
    }
  },
});
