// E2E test: Sandbox OAuth 2.0 Client creation from Admin and Developer portals.
//
// Verifies:
//   1. Admin can mint a sandbox client (sbx_*) without Turnstile / velocity gates.
//   2. Developer self-service can mint a sandbox client (sbx_*).
//   3. Both resulting client_id / client_secret pairs successfully exchange for
//      an access_token via the oauth-token endpoint using client_credentials.
//
// Required env (loaded from project .env via dotenv):
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
// Optional credentials (test is skipped per role when missing):
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
//   TEST_DEVELOPER_EMAIL, TEST_DEVELOPER_PASSWORD
//
// The function should reject the developer path with 403 if Turnstile is
// enforced server-side (TURNSTILE_ENFORCE=true). To run the developer leg of
// this test in CI, ensure TURNSTILE_ENFORCE is unset or set to "false" in the
// sandbox edge environment.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
  ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
  ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const FN_BASE = `${SUPABASE_URL}/functions/v1`;

async function signIn(email: string, password: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function createSandboxClient(
  accessToken: string,
  label: string,
): Promise<{ client_id: string; client_secret: string; api_environment: string }> {
  const res = await fetch(`${FN_BASE}/sandbox-create-oauth-client`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON,
    },
    body: JSON.stringify({
      client_name: `E2E ${label} ${Date.now()}`,
      redirect_uris: ["https://ci.kangopenbanking.com/callback"],
      scopes: ["openid", "accounts"],
      grant_types: ["client_credentials", "authorization_code", "refresh_token"],
      rate_limit_tier: "free",
      developer_company: "E2E Suite",
      developer_use_case: "Automated portal client creation test",
    }),
  });
  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`sandbox-create-oauth-client (${label}) ${res.status}: ${JSON.stringify(body)}`);
  }
  assert(body.client_id.startsWith("sbx_"), `Expected sbx_ prefix, got ${body.client_id}`);
  assert(typeof body.client_secret === "string" && body.client_secret.length >= 32);
  assertEquals(body.api_environment, "sandbox");
  return body;
}

async function exchangeClientCredentials(client_id: string, client_secret: string) {
  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", client_id);
  form.set("client_secret", client_secret);
  form.set("scope", "accounts");

  const res = await fetch(`${FN_BASE}/oauth-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "apikey": SUPABASE_ANON,
    },
    body: form.toString(),
  });
  const body = await res.json();
  if (res.status !== 200) {
    throw new Error(`oauth-token ${res.status}: ${JSON.stringify(body)}`);
  }
  assert(typeof body.access_token === "string" && body.access_token.length > 20, "missing access_token");
  assertEquals(body.token_type?.toLowerCase(), "bearer");
  assert(typeof body.expires_in === "number" && body.expires_in > 0);
  return body;
}

Deno.test("Admin portal → mints sbx_ client and obtains an access_token", async () => {
  const email = Deno.env.get("TEST_ADMIN_EMAIL");
  const password = Deno.env.get("TEST_ADMIN_PASSWORD");
  if (!email || !password) {
    console.warn("Skipping admin leg — TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD not set");
    return;
  }
  const token = await signIn(email, password);
  const client = await createSandboxClient(token, "admin");
  const tokens = await exchangeClientCredentials(client.client_id, client.client_secret);
  console.log(`Admin sandbox client OK: ${client.client_id} → token expires_in=${tokens.expires_in}s`);
});

Deno.test("Developer portal → mints sbx_ client and obtains an access_token", async () => {
  const email = Deno.env.get("TEST_DEVELOPER_EMAIL");
  const password = Deno.env.get("TEST_DEVELOPER_PASSWORD");
  if (!email || !password) {
    console.warn("Skipping developer leg — TEST_DEVELOPER_EMAIL/TEST_DEVELOPER_PASSWORD not set");
    return;
  }
  const token = await signIn(email, password);
  const client = await createSandboxClient(token, "developer");
  const tokens = await exchangeClientCredentials(client.client_id, client.client_secret);
  console.log(`Developer sandbox client OK: ${client.client_id} → token expires_in=${tokens.expires_in}s`);
});

Deno.test("Wrong client_secret is rejected with invalid_client", async () => {
  const email = Deno.env.get("TEST_ADMIN_EMAIL") ?? Deno.env.get("TEST_DEVELOPER_EMAIL");
  const password = Deno.env.get("TEST_ADMIN_PASSWORD") ?? Deno.env.get("TEST_DEVELOPER_PASSWORD");
  if (!email || !password) {
    console.warn("Skipping negative test — no test credentials available");
    return;
  }
  const token = await signIn(email, password);
  const client = await createSandboxClient(token, "negative");

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", client.client_id);
  form.set("client_secret", "wrong-secret-deliberately-invalid");
  const res = await fetch(`${FN_BASE}/oauth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "apikey": SUPABASE_ANON },
    body: form.toString(),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "invalid_client");
});
