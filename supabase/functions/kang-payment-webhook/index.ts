// Kang Agent — payment webhook (Stripe/PayPal-compatible)
// Handles subscription payment events, updates kang_subscriptions,
// writes credit_score_ledger entries, and adjusts profiles.credit_score.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifySignature(secret: string, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Accept "sha256=<hex>" or raw hex
  const provided = signatureHeader.replace(/^sha256=/, "").trim().toLowerCase();
  return provided === hex;
}

type NormalizedEvent =
  | { kind: "payment_success"; userId: string }
  | { kind: "payment_failed"; userId: string }
  | { kind: "subscription_cancelled"; userId: string }
  | { kind: "unknown" };

function normalize(body: any): NormalizedEvent {
  const type: string = body?.type ?? body?.event ?? "";
  const userId: string | undefined =
    body?.data?.object?.metadata?.user_id ??
    body?.data?.user_id ??
    body?.user_id ??
    body?.resource?.custom_id;

  if (!userId) return { kind: "unknown" };

  if (["payment.success", "invoice.payment_succeeded", "PAYMENT.SALE.COMPLETED"].includes(type)) {
    return { kind: "payment_success", userId };
  }
  if (["payment.failed", "invoice.payment_failed", "PAYMENT.SALE.DENIED"].includes(type)) {
    return { kind: "payment_failed", userId };
  }
  if (["subscription.cancelled", "customer.subscription.deleted", "BILLING.SUBSCRIPTION.CANCELLED"].includes(type)) {
    return { kind: "subscription_cancelled", userId };
  }
  return { kind: "unknown" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const rawBody = await req.text();
    const secret = Deno.env.get("KANG_PAYMENT_WEBHOOK_SECRET");
    if (secret) {
      const sigHeader = req.headers.get("x-webhook-signature") ?? req.headers.get("stripe-signature");
      const ok = await verifySignature(secret, rawBody, sigHeader);
      if (!ok) {
        console.warn("[kang-payment-webhook] invalid signature");
        return json({ success: false, error: "invalid_signature" }, 401);
      }
    }

    let body: any;
    try { body = JSON.parse(rawBody); } catch { return json({ success: false, error: "invalid_json" }, 400); }
    console.log("[kang-payment-webhook] event received", body?.type ?? body?.event);

    const event = normalize(body);
    if (event.kind === "unknown") {
      console.log("[kang-payment-webhook] unknown/unhandled event");
      return json({ success: true, ignored: true });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { userId } = event;

    // Load or bootstrap subscription
    const { data: sub } = await admin
      .from("kang_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (event.kind === "payment_success") {
      await admin.from("kang_subscriptions").upsert({
        user_id: userId,
        status: "active",
        last_payment_status: "success",
        questions_asked_count: 0,
        current_period_start: now.toISOString(),
        current_period_end: in30.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" });

      await admin.from("credit_score_ledger").insert({
        user_id: userId,
        points_change: 1,
        reason: "Monthly Subscription Paid On Time",
      });

      const { data: profile } = await admin
        .from("profiles")
        .select("user_id, credit_score")
        .eq("user_id", userId)
        .maybeSingle();
      const current = profile?.credit_score ?? 500;
      await admin.from("profiles").update({ credit_score: current + 1 }).eq("user_id", userId);

      return json({ success: true, action: "payment_success_applied" });
    }

    if (event.kind === "payment_failed") {
      const alreadyFailed = sub?.last_payment_status === "failed";
      await admin.from("kang_subscriptions").upsert({
        user_id: userId,
        last_payment_status: "failed",
        status: alreadyFailed ? "suspended" : (sub?.status ?? "trial"),
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" });

      await admin.from("credit_score_ledger").insert({
        user_id: userId,
        points_change: -3,
        reason: "Monthly Subscription Payment Missed",
      });

      const { data: profile } = await admin
        .from("profiles")
        .select("user_id, credit_score")
        .eq("user_id", userId)
        .maybeSingle();
      const current = profile?.credit_score ?? 500;
      await admin.from("profiles").update({ credit_score: Math.max(0, current - 3) }).eq("user_id", userId);

      return json({ success: true, action: "payment_failed_applied", suspended: alreadyFailed });
    }

    if (event.kind === "subscription_cancelled") {
      await admin.from("kang_subscriptions").upsert({
        user_id: userId,
        status: "suspended",
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" });
      return json({ success: true, action: "subscription_cancelled_applied" });
    }

    return json({ success: true, ignored: true });
  } catch (e) {
    console.error("[kang-payment-webhook] error", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
