// Kang Agent — chat handler E2E tests
// Runs against the deployed edge functions using seeded test users.
// Skips gracefully when required credentials are not available.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TEST_PASSWORD = Deno.env.get("E2E_PASSWORD");
const USER_A_EMAIL = Deno.env.get("E2E_CONSUMER_EMAIL") ?? "e2e+consumer@kob.test";
const USER_B_EMAIL = Deno.env.get("E2E_MERCHANT_EMAIL") ?? "e2e+merchant@kob.test";

const canRun = !!(SUPABASE_URL && ANON && SERVICE && TEST_PASSWORD);

async function signIn(email: string): Promise<{ token: string; userId: string }> {
  const client = createClient(SUPABASE_URL!, ANON!);
  const { data, error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD! });
  if (error || !data.session) throw new Error(`signin failed for ${email}: ${error?.message}`);
  return { token: data.session.access_token, userId: data.user!.id };
}

async function resetSubscription(userId: string, patch: Record<string, unknown>) {
  const admin = createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } });
  await admin.from("kang_subscriptions").upsert({
    user_id: userId,
    status: "trial",
    questions_asked_count: 0,
    free_questions_limit: 5,
    last_payment_status: "none",
    ...patch,
  }, { onConflict: "user_id" });
}

async function chat(token: string, message: string, session_id?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/kang-chat-handler`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, session_id }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

Deno.test({
  name: "Test 1: Trial user can ask up to 5 questions",
  ignore: !canRun,
  fn: async () => {
    const { token, userId } = await signIn(USER_A_EMAIL);
    await resetSubscription(userId, { questions_asked_count: 0, status: "trial" });
    let session_id: string | undefined;
    for (let i = 1; i <= 5; i++) {
      const { status, body } = await chat(token, `Test question ${i}`, session_id);
      assertEquals(status, 200, `q${i} status`);
      assert(body.success, `q${i} success`);
      session_id ??= body.session_id;
    }
    const admin = createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } });
    const { data: sub } = await admin.from("kang_subscriptions").select("questions_asked_count").eq("user_id", userId).single();
    assertEquals(sub?.questions_asked_count, 5);
  },
});

Deno.test({
  name: "Test 2: Trial user blocked after 5 questions",
  ignore: !canRun,
  fn: async () => {
    const { token, userId } = await signIn(USER_A_EMAIL);
    await resetSubscription(userId, { questions_asked_count: 5, status: "trial" });
    const { body } = await chat(token, "Sixth question");
    assertEquals(body.success, false);
    assertEquals(body.error, "limit_reached");
    const admin = createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } });
    const { data: sub } = await admin.from("kang_subscriptions").select("questions_asked_count").eq("user_id", userId).single();
    assertEquals(sub?.questions_asked_count, 5, "counter must not increment");
  },
});

Deno.test({
  name: "Test 3: Active subscriber has unlimited questions",
  ignore: !canRun,
  fn: async () => {
    const { token, userId } = await signIn(USER_A_EMAIL);
    await resetSubscription(userId, { questions_asked_count: 999, status: "active", last_payment_status: "success" });
    for (let i = 0; i < 7; i++) {
      const { body } = await chat(token, `Active user q${i}`);
      assert(body.success, `active q${i}`);
    }
  },
});

Deno.test({
  name: "Test 4: User cannot access another user's session",
  ignore: !canRun,
  fn: async () => {
    const a = await signIn(USER_A_EMAIL);
    const b = await signIn(USER_B_EMAIL);
    await resetSubscription(a.userId, { questions_asked_count: 0, status: "active" });
    const created = await chat(a.token, "Owned by A");
    const sessionId = created.body.session_id;
    assert(sessionId, "session created");

    const res = await fetch(`${SUPABASE_URL}/functions/v1/kang-session-messages?session_id=${sessionId}`, {
      headers: { Authorization: `Bearer ${b.token}` },
    });
    const body = await res.json();
    assertEquals(res.status, 403);
    assertEquals(body.error, "forbidden");
  },
});
