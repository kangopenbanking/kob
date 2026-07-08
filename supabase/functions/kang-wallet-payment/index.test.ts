// Kang Agent — wallet-payment E2E tests
// Run with: `deno test --allow-net --allow-env`
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const FN_URL = `${SUPABASE_URL}/functions/v1/kang-wallet-payment`;

async function seedUser(balance: number) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const email = `kang-test-${crypto.randomUUID()}@example.com`;
  const password = "TestPass!12345";
  const { data: u } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  const userId = u!.user!.id;
  const { data: acct } = await admin.from("accounts").insert({
    user_id: userId,
    account_holder_name: "Test",
    account_id: `KANG-TEST-${userId.slice(0, 6)}`,
    identification_value: `KANG-TEST-${userId.slice(0, 6)}`,
    account_type: "Personal",
    account_subtype: "Current",
    currency: "XAF",
    is_active: true,
  }).select().single();
  await admin.from("account_balances").insert({
    account_id: acct!.id,
    balance_type: "ClosingAvailable",
    credit_debit_indicator: "Credit",
    amount: balance,
    currency: "XAF",
    balance_datetime: new Date().toISOString(),
  });
  const { data: sess } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  // Sign in via password
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
  return { userId, token: signIn.session!.access_token, admin };
}

async function cleanup(userId: string) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

Deno.test({
  name: "Payment succeeds when wallet balance >= fee",
  ignore: !SERVICE_ROLE,
  async fn() {
    const { userId, token, admin } = await seedUser(5000);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json();
      assertEquals(body.success, true);
      assertEquals(body.new_balance, 3000);
      const { data: sub } = await admin.from("kang_subscriptions").select().eq("user_id", userId).maybeSingle();
      assertEquals(sub!.status, "active");
      assertEquals(sub!.questions_asked_count, 0);
      const { data: ledger } = await admin.from("credit_score_ledger").select().eq("user_id", userId);
      assert(ledger!.some((l: any) => l.points_change === 1));
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "Payment fails when wallet balance < fee",
  ignore: !SERVICE_ROLE,
  async fn() {
    const { userId, token, admin } = await seedUser(500);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json();
      assertEquals(body.success, false);
      assertEquals(body.error, "insufficient_funds");
      assertEquals(body.current_balance, 500);
      const { data: sub } = await admin.from("kang_subscriptions").select().eq("user_id", userId).maybeSingle();
      assertEquals(sub!.status, "suspended");
      assertEquals(sub!.last_payment_status, "failed");
      const { data: ledger } = await admin.from("credit_score_ledger").select().eq("user_id", userId);
      assert(ledger!.some((l: any) => l.points_change === -3));
    } finally {
      await cleanup(userId);
    }
  },
});

Deno.test({
  name: "Atomic RPC prevents concurrent double-charge",
  ignore: !SERVICE_ROLE,
  async fn() {
    const { userId, token } = await seedUser(2500); // enough for ONE 2000-fee only
    try {
      const [r1, r2] = await Promise.all([
        fetch(FN_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(FN_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      const successes = [r1, r2].filter(r => r.success).length;
      assertEquals(successes, 1, "Only one concurrent request should succeed");
    } finally {
      await cleanup(userId);
    }
  },
});
