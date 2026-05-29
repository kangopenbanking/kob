// Canonical rail-agnostic Payment Intents endpoint (Phase 8).
// Standing Order #3 citation: Stripe API Reference §payment_intents; UK Open Banking Read/Write API v3.1.10.
//
// Routes (all under /functions/v1/payment-intents):
//   POST /                       → create intent (202 Accepted)
//   GET  /                       → list merchant intents
//   GET  /:id                    → retrieve intent
//   POST /:id/confirm            → transition requires_confirmation → processing
//   POST /:id/cancel             → transition to canceled
//
// Idempotency: honors Idempotency-Key header via unique (merchant_id, idempotency_key).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { problemResponse } from "../_shared/integration-layer/problem.ts";

const VALID_METHODS = new Set(["mobile_money", "bank_transfer", "card", "pay_by_bank", "wallet"]);
const VALID_STATUS = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "processing",
  "requires_action",
  "succeeded",
  "canceled",
  "failed",
]);

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip /functions/v1/payment-intents prefix
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const fnIdx = parts.indexOf("payment-intents");
  const sub = fnIdx >= 0 ? parts.slice(fnIdx + 1) : parts;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return problemResponse(req, 401, "Unauthorized", "Missing or invalid Authorization header.");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return problemResponse(req, 401, "Unauthorized", "Invalid credentials.");
    }
    const merchantId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    // Routing
    const id = sub[0];
    const verb = sub[1];

    // ---- POST / (create) ----
    if (req.method === "POST" && !id) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return problemResponse(req, 400, "Bad Request", "Request body must be valid JSON.");
      }
      const { amount, currency, payment_method_types, confirm, description, metadata, customer_id } = body as Record<string, unknown>;
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
        return problemResponse(req, 422, "Unprocessable Entity", "amount must be a positive integer.", {
          type: "https://api.kangopenbanking.com/errors/validation",
        });
      }
      if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
        return problemResponse(req, 422, "Unprocessable Entity", "currency must be a 3-letter ISO 4217 code.");
      }
      if (!Array.isArray(payment_method_types) || payment_method_types.length === 0 ||
          !payment_method_types.every((t) => typeof t === "string" && VALID_METHODS.has(t))) {
        return problemResponse(req, 422, "Unprocessable Entity", "payment_method_types must be a non-empty array of supported types.");
      }

      const idempotencyKey = req.headers.get("Idempotency-Key") || null;
      const status = confirm ? "processing" : "requires_confirmation";

      // Idempotency replay check
      if (idempotencyKey) {
        const { data: existing } = await admin
          .from("payment_intents")
          .select("*")
          .eq("merchant_id", merchantId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing) {
          return json(existing, 202, {
            "X-Idempotent-Replay": "true",
            "X-Idempotency-Status": "replayed",
          });
        }
      }

      const { data: created, error: insErr } = await admin
        .from("payment_intents")
        .insert({
          merchant_id: merchantId,
          amount,
          currency,
          status,
          payment_method_types,
          description: typeof description === "string" ? description : null,
          metadata: (metadata && typeof metadata === "object") ? metadata : {},
          customer_id: typeof customer_id === "string" ? customer_id : null,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === "23505") {
          // unique violation on (merchant_id, idempotency_key) — race
          const { data: again } = await admin
            .from("payment_intents")
            .select("*")
            .eq("merchant_id", merchantId)
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
          if (again) return json(again, 202, { "X-Idempotent-Replay": "true", "X-Idempotency-Status": "replayed" });
        }
        return problemResponse(req, 500, "Internal Server Error", insErr.message);
      }

      return json(created, 202, {
        "X-Idempotent-Replay": "false",
        "X-Idempotency-Status": "first_request",
      });
    }

    // ---- GET / (list) ----
    if (req.method === "GET" && !id) {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "25", 10), 100);
      const statusFilter = url.searchParams.get("status");
      let q = admin.from("payment_intents").select("*").eq("merchant_id", merchantId)
        .order("created_at", { ascending: false }).limit(limit + 1);
      if (statusFilter && VALID_STATUS.has(statusFilter)) q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) return problemResponse(req, 500, "Internal Server Error", error.message);
      const hasMore = (data?.length || 0) > limit;
      return json({ data: (data || []).slice(0, limit), has_more: hasMore, next_cursor: null });
    }

    // ---- GET /:id ----
    if (req.method === "GET" && id && !verb) {
      const { data, error } = await admin.from("payment_intents").select("*")
        .eq("id", id).eq("merchant_id", merchantId).maybeSingle();
      if (error) return problemResponse(req, 500, "Internal Server Error", error.message);
      if (!data) return problemResponse(req, 404, "Not Found", `Payment intent ${id} not found.`);
      return json(data);
    }

    // ---- POST /:id/confirm ----
    if (req.method === "POST" && id && verb === "confirm") {
      const { data: pi } = await admin.from("payment_intents").select("*")
        .eq("id", id).eq("merchant_id", merchantId).maybeSingle();
      if (!pi) return problemResponse(req, 404, "Not Found", `Payment intent ${id} not found.`);
      if (!["requires_confirmation", "requires_action"].includes(pi.status)) {
        return problemResponse(req, 409, "Conflict",
          `Cannot confirm a payment intent in status '${pi.status}'.`,
          { type: "https://api.kangopenbanking.com/errors/invalid-state-transition" });
      }
      const { data: updated, error } = await admin.from("payment_intents")
        .update({ status: "processing" })
        .eq("id", id).select().single();
      if (error) return problemResponse(req, 500, "Internal Server Error", error.message);
      return json(updated);
    }

    // ---- POST /:id/cancel ----
    if (req.method === "POST" && id && verb === "cancel") {
      const { data: pi } = await admin.from("payment_intents").select("*")
        .eq("id", id).eq("merchant_id", merchantId).maybeSingle();
      if (!pi) return problemResponse(req, 404, "Not Found", `Payment intent ${id} not found.`);
      if (["succeeded", "canceled", "failed"].includes(pi.status)) {
        return problemResponse(req, 409, "Conflict",
          `Cannot cancel a payment intent in terminal status '${pi.status}'.`);
      }
      const { data: updated, error } = await admin.from("payment_intents")
        .update({ status: "canceled" })
        .eq("id", id).select().single();
      if (error) return problemResponse(req, 500, "Internal Server Error", error.message);
      return json(updated);
    }

    return problemResponse(req, 404, "Not Found", `No route for ${req.method} ${url.pathname}`);
  } catch (err) {
    return problemResponse(req, 500, "Internal Server Error", (err as Error).message);
  }
});
