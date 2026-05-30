/**
 * E2E smoke test for admin-kyc-review — request-more-info flow + RBAC.
 *
 * Skipped automatically when E2E credentials are not configured.
 * See e2e/SEEDING.md for the secret + seeding setup.
 *
 * Pre-conditions when running:
 *   - E2E_PASSWORD + E2E_*_EMAIL secrets configured
 *   - VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY in env
 *   - A pending KYC row exists (the consumer test user submits one in the spec)
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
const ADMIN_EMAIL = Deno.env.get("E2E_ADMIN_EMAIL");
const CONSUMER_EMAIL = Deno.env.get("E2E_CONSUMER_EMAIL");
const PASSWORD = Deno.env.get("E2E_PASSWORD");

const SHOULD_RUN = !!(SUPABASE_URL && ANON_KEY && ADMIN_EMAIL && CONSUMER_EMAIL && PASSWORD);

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY! },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  assertEquals(res.status, 200, `signin ${email} failed: ${JSON.stringify(body)}`);
  return body.access_token as string;
}

async function callReview(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-kyc-review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

Deno.test({
  name: "admin-kyc-review rejects unauthenticated callers",
  ignore: !SHOULD_RUN,
  async fn() {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-kyc-review`, {
      method: "POST",
      headers: { apikey: ANON_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ kyc_id: "00000000-0000-0000-0000-000000000000", action: "approved" }),
    });
    await res.text();
    // Either 401 from our explicit guard or 401 from edge gateway when JWT missing.
    if (![400, 401].includes(res.status)) {
      throw new Error(`expected 401/400, got ${res.status}`);
    }
  },
});

Deno.test({
  name: "admin-kyc-review rejects non-reviewer callers with 403",
  ignore: !SHOULD_RUN,
  async fn() {
    const token = await signIn(CONSUMER_EMAIL!);
    const { status, body } = await callReview(token, {
      kyc_id: "00000000-0000-0000-0000-000000000000",
      action: "approved",
    });
    assertEquals(status, 403);
    assertExists(body.error);
  },
});

Deno.test({
  name: "admin-kyc-review validates info_requested requires a message",
  ignore: !SHOULD_RUN,
  async fn() {
    const token = await signIn(ADMIN_EMAIL!);
    const { status, body } = await callReview(token, {
      kyc_id: "00000000-0000-0000-0000-000000000000",
      action: "info_requested",
    });
    assertEquals(status, 400);
    assertEquals(body.error, "Information request message is required");
  },
});

Deno.test({
  name: "admin-kyc-review validates rejected requires a reason",
  ignore: !SHOULD_RUN,
  async fn() {
    const token = await signIn(ADMIN_EMAIL!);
    const { status, body } = await callReview(token, {
      kyc_id: "00000000-0000-0000-0000-000000000000",
      action: "rejected",
    });
    assertEquals(status, 400);
    assertEquals(body.error, "Rejection reason is required");
  },
});

Deno.test({
  name: "admin-kyc-review info_requested updates status, audit log and notification",
  ignore: !SHOULD_RUN,
  async fn() {
    const adminToken = await signIn(ADMIN_EMAIL!);
    const consumerToken = await signIn(CONSUMER_EMAIL!);

    // 1. Find or create a pending KYC for the consumer test user.
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${consumerToken}`, apikey: ANON_KEY! },
    });
    const me = await meRes.json();
    const consumerId = me.id as string;

    const findPending = async () => {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/kyc_verifications?select=id,status&user_id=eq.${consumerId}&status=eq.pending&order=created_at.desc&limit=1`,
        { headers: { Authorization: `Bearer ${adminToken}`, apikey: ANON_KEY! } },
      );
      return ((await r.json()) as Array<{ id: string }>)[0];
    };

    let pending = await findPending();
    if (!pending) {
      // Seed one via the consumer's REST insert (RLS-friendly path).
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/kyc_verifications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${consumerToken}`,
          apikey: ANON_KEY!,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: consumerId,
          document_type: "national_id",
          document_number: `E2E-${Date.now()}`,
          status: "pending",
        }),
      });
      const created = await ins.json();
      pending = Array.isArray(created) ? created[0] : created;
    }
    assertExists(pending?.id, "could not obtain a pending KYC for the consumer");

    // 2. Call info_requested.
    const { status, body } = await callReview(adminToken, {
      kyc_id: pending.id,
      action: "info_requested",
      info_request_message: "Please upload a clearer back-of-ID photo and a fresh selfie.",
    });
    assertEquals(status, 200, JSON.stringify(body));
    assertEquals(body.success, true);

    // 3. Status should now be info_requested with the message persisted.
    const after = await fetch(
      `${SUPABASE_URL}/rest/v1/kyc_verifications?select=status,rejection_reason,verified_by&id=eq.${pending.id}`,
      { headers: { Authorization: `Bearer ${adminToken}`, apikey: ANON_KEY! } },
    );
    const [row] = (await after.json()) as Array<{
      status: string;
      rejection_reason: string;
      verified_by: string;
    }>;
    assertEquals(row.status, "info_requested");
    assertExists(row.rejection_reason);
    assertExists(row.verified_by);

    // 4. Audit log row should exist.
    const audit = await fetch(
      `${SUPABASE_URL}/rest/v1/audit_logs?select=action_type,entity_id,details&entity_id=eq.${pending.id}&action_type=eq.kyc_info_requested&order=created_at.desc&limit=1`,
      { headers: { Authorization: `Bearer ${adminToken}`, apikey: ANON_KEY! } },
    );
    const auditRows = (await audit.json()) as Array<{ details: any }>;
    assertEquals(auditRows.length, 1);
    assertExists(auditRows[0].details?.info_request_message);

    // 5. In-app notification for the customer.
    const notif = await fetch(
      `${SUPABASE_URL}/rest/v1/app_notifications?select=title,type&user_id=eq.${consumerId}&order=created_at.desc&limit=5`,
      { headers: { Authorization: `Bearer ${adminToken}`, apikey: ANON_KEY! } },
    );
    const notifs = (await notif.json()) as Array<{ title: string; type: string }>;
    const hit = notifs.find((n) => /additional information/i.test(n.title));
    assertExists(hit, "expected an in-app info_requested notification");
  },
});
