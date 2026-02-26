import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("firebase-phone-verify: rejects missing token", async () => {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/firebase-phone-verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();
  assertEquals(response.status, 400);
  assertEquals(data.error, "firebase_id_token is required");
});

Deno.test("firebase-phone-verify: rejects invalid token", async () => {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/firebase-phone-verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ firebase_id_token: "invalid-token-here" }),
    }
  );

  const data = await response.json();
  assertEquals(response.status, 401);
  assertEquals(data.error, "Invalid Firebase token");
});

Deno.test("firebase-phone-verify: handles CORS preflight", async () => {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/firebase-phone-verify`,
    {
      method: "OPTIONS",
      headers: {
        "Origin": "https://example.com",
        "Access-Control-Request-Method": "POST",
      },
    }
  );

  await response.text();
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});
