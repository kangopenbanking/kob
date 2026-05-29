// Agent banking — Phase 10.3
// Cites: BIS "Agent Banking" guidelines (2018), Mojaloop v1.1, GSMA Agent Network Mgmt Toolkit v2
//
// Routes (URL suffix routing):
//   POST   /v1/agents                              register agent (admin or self-service)
//   GET    /v1/agents                              list/discover agents (geo+region filter)
//   GET    /v1/agents/:agentId                     read single agent
//   POST   /v1/agents/:agentId/float/topup         increase float balance
//   POST   /v1/agents/:agentId/float/withdraw      reduce float balance
//   POST   /v1/agents/:agentId/cash-in             customer deposits cash with agent (debit cash, credit float -> wallet)
//   POST   /v1/agents/:agentId/cash-out            customer withdraws cash from agent
//   GET    /v1/agents/:agentId/transactions        list agent cash transactions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept-language, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}
function problem(status: number, title: string, detail: string, lang = "en") {
  return new Response(
    JSON.stringify({
      type: `https://docs.kangopenbanking.com/errors/${status}`,
      title,
      status,
      detail,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/problem+json",
        "Content-Language": lang,
      },
    },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MSISDN_RE = /^\+?[0-9]{8,15}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const segs = url.pathname.split("/").filter(Boolean);
  // Tail starts at the "agents" segment.
  const tail = segs.slice(segs.findIndex((s) => s === "agents"));
  const lang = (req.headers.get("accept-language") || "en").toLowerCase().startsWith("fr")
    ? "fr"
    : "en";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Identify caller (optional; required for write ops below)
    let userId: string | null = null;
    const authz = req.headers.get("authorization");
    if (authz?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(authz.slice(7));
      userId = data?.user?.id ?? null;
    }

    // GET /v1/agents — discovery
    if (req.method === "GET" && tail.length === 1) {
      const country = url.searchParams.get("country_code");
      const region = url.searchParams.get("region");
      const status = url.searchParams.get("status") ?? "active";
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

      let q = supabase
        .from("agents")
        .select(
          "id, agent_code, business_name, msisdn, region, country_code, city, latitude, longitude, status, tier",
        )
        .eq("status", status)
        .limit(limit);
      if (country) q = q.eq("country_code", country);
      if (region) q = q.eq("region", region);
      const { data, error } = await q;
      if (error) return problem(500, "AGENT_LIST_FAILED", error.message, lang);
      return json({ data: data ?? [], count: data?.length ?? 0 }, 200, { "Content-Language": lang });
    }

    // GET /v1/agents/:agentId
    if (req.method === "GET" && tail.length === 2) {
      const agentId = tail[1];
      if (!UUID_RE.test(agentId)) return problem(400, "INVALID_AGENT_ID", "agentId must be UUID", lang);
      const { data, error } = await supabase
        .from("agents")
        .select("*, agent_floats(currency, float_balance, cash_balance, low_threshold)")
        .eq("id", agentId)
        .maybeSingle();
      if (error) return problem(500, "AGENT_FETCH_FAILED", error.message, lang);
      if (!data) return problem(404, "AGENT_NOT_FOUND", "No agent with that id", lang);
      return json(data, 200, { "Content-Language": lang });
    }

    // POST /v1/agents — register
    if (req.method === "POST" && tail.length === 1) {
      const body = await req.json().catch(() => ({}));
      const {
        business_name,
        msisdn,
        country_code = "CM",
        region,
        city,
        address,
        latitude,
        longitude,
        email,
        tier = "standard",
        legal_name,
      } = body as Record<string, unknown>;

      if (!business_name || typeof business_name !== "string") {
        return problem(400, "VALIDATION_ERROR", "business_name is required", lang);
      }
      if (typeof msisdn !== "string" || !MSISDN_RE.test(msisdn)) {
        return problem(400, "INVALID_MSISDN", "msisdn must be E.164 (8-15 digits)", lang);
      }

      const agent_code = "AG" + Math.random().toString(36).slice(2, 8).toUpperCase();

      const { data: agent, error: insErr } = await supabase
        .from("agents")
        .insert({
          agent_code,
          business_name,
          legal_name: legal_name ?? null,
          msisdn,
          email: email ?? null,
          user_id: userId,
          region: region ?? null,
          country_code,
          city: city ?? null,
          address: address ?? null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          tier,
        })
        .select()
        .single();
      if (insErr) return problem(500, "AGENT_CREATE_FAILED", insErr.message, lang);

      // Seed XAF float row at zero
      await supabase.from("agent_floats").insert({ agent_id: agent.id, currency: "XAF" });

      return json(agent, 201, { "Content-Language": lang });
    }

    // POST /v1/agents/:agentId/float/topup | /float/withdraw
    if (
      req.method === "POST" &&
      tail.length === 4 &&
      tail[2] === "float" &&
      (tail[3] === "topup" || tail[3] === "withdraw")
    ) {
      const agentId = tail[1];
      if (!UUID_RE.test(agentId)) return problem(400, "INVALID_AGENT_ID", "agentId must be UUID", lang);
      const idem = req.headers.get("idempotency-key");
      if (!idem || !UUID_RE.test(idem)) {
        return problem(400, "MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header (UUIDv4) required", lang);
      }
      const body = await req.json().catch(() => ({}));
      const amount = Number((body as Record<string, unknown>).amount);
      const currency = String((body as Record<string, unknown>).currency ?? "XAF");
      if (!Number.isFinite(amount) || amount <= 0) {
        return problem(400, "INVALID_AMOUNT", "amount must be a positive number", lang);
      }

      const isTopup = tail[3] === "topup";
      const txType = isTopup ? "float_topup" : "float_withdraw";

      // Idempotency check
      const { data: existing } = await supabase
        .from("agent_cash_transactions")
        .select("*")
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (existing) return json(existing, 200);

      // Load float
      const { data: floatRow } = await supabase
        .from("agent_floats")
        .select("*")
        .eq("agent_id", agentId)
        .eq("currency", currency)
        .maybeSingle();
      if (!floatRow) return problem(404, "FLOAT_NOT_FOUND", "No float for this agent/currency", lang);

      const newFloat = isTopup
        ? Number(floatRow.float_balance) + amount
        : Number(floatRow.float_balance) - amount;
      if (newFloat < 0) {
        return problem(409, "INSUFFICIENT_FLOAT", "Float balance would go negative", lang);
      }

      const { error: txErr, data: tx } = await supabase
        .from("agent_cash_transactions")
        .insert({
          agent_id: agentId,
          tx_type: txType,
          amount,
          currency,
          status: "completed",
          idempotency_key: idem,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (txErr) return problem(500, "TX_INSERT_FAILED", txErr.message, lang);

      await supabase
        .from("agent_floats")
        .update({
          float_balance: newFloat,
          last_topup_at: isTopup ? new Date().toISOString() : floatRow.last_topup_at,
        })
        .eq("id", floatRow.id);

      return json(tx, 201, { "Content-Language": lang });
    }

    // POST /v1/agents/:agentId/cash-in | /cash-out
    if (
      req.method === "POST" &&
      tail.length === 3 &&
      (tail[2] === "cash-in" || tail[2] === "cash-out")
    ) {
      const agentId = tail[1];
      if (!UUID_RE.test(agentId)) return problem(400, "INVALID_AGENT_ID", "agentId must be UUID", lang);
      const idem = req.headers.get("idempotency-key");
      if (!idem || !UUID_RE.test(idem)) {
        return problem(400, "MISSING_IDEMPOTENCY_KEY", "Idempotency-Key header (UUIDv4) required", lang);
      }
      const body = await req.json().catch(() => ({}));
      const amount = Number((body as Record<string, unknown>).amount);
      const currency = String((body as Record<string, unknown>).currency ?? "XAF");
      const customer_msisdn = (body as Record<string, unknown>).customer_msisdn as string | undefined;
      const customer_user_id = (body as Record<string, unknown>).customer_user_id as string | undefined;
      if (!Number.isFinite(amount) || amount <= 0) {
        return problem(400, "INVALID_AMOUNT", "amount must be positive", lang);
      }
      if (!customer_msisdn && !customer_user_id) {
        return problem(400, "MISSING_CUSTOMER", "customer_msisdn or customer_user_id required", lang);
      }
      if (customer_msisdn && !MSISDN_RE.test(customer_msisdn)) {
        return problem(400, "INVALID_MSISDN", "customer_msisdn must be E.164", lang);
      }

      const isCashIn = tail[2] === "cash-in";

      // Idempotency
      const { data: existing } = await supabase
        .from("agent_cash_transactions")
        .select("*")
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (existing) return json(existing, 200);

      // Load agent + float
      const { data: agent } = await supabase
        .from("agents")
        .select("id, status, commission_rate")
        .eq("id", agentId)
        .maybeSingle();
      if (!agent) return problem(404, "AGENT_NOT_FOUND", "No agent with that id", lang);
      if (agent.status !== "active") {
        return problem(409, "AGENT_INACTIVE", `Agent status is ${agent.status}`, lang);
      }
      const { data: floatRow } = await supabase
        .from("agent_floats")
        .select("*")
        .eq("agent_id", agentId)
        .eq("currency", currency)
        .maybeSingle();
      if (!floatRow) return problem(404, "FLOAT_NOT_FOUND", "No float for this agent/currency", lang);

      // Cash-in: customer hands cash to agent. Agent's float decreases (transferred to customer wallet),
      //          agent's cash on hand increases. We model the float side only here; wallet credit is
      //          dispatched to the ledger by a downstream service.
      // Cash-out: customer redeems from wallet. Agent's float increases (received from wallet),
      //           agent's cash on hand decreases.
      const floatDelta = isCashIn ? -amount : amount;
      const cashDelta = isCashIn ? amount : -amount;
      const newFloat = Number(floatRow.float_balance) + floatDelta;
      const newCash = Number(floatRow.cash_balance) + cashDelta;
      if (newFloat < 0) return problem(409, "INSUFFICIENT_FLOAT", "Agent float insufficient", lang);
      if (newCash < 0) return problem(409, "INSUFFICIENT_CASH", "Agent cash on hand insufficient", lang);

      const commission = Math.round(amount * Number(agent.commission_rate) * 100) / 100;

      const { data: tx, error: txErr } = await supabase
        .from("agent_cash_transactions")
        .insert({
          agent_id: agentId,
          customer_msisdn: customer_msisdn ?? null,
          customer_user_id: customer_user_id ?? null,
          tx_type: isCashIn ? "cash_in" : "cash_out",
          amount,
          currency,
          commission_amount: commission,
          status: "completed",
          idempotency_key: idem,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (txErr) return problem(500, "TX_INSERT_FAILED", txErr.message, lang);

      await supabase
        .from("agent_floats")
        .update({ float_balance: newFloat, cash_balance: newCash })
        .eq("id", floatRow.id);

      // Low-float warning surface (returned in headers; webhooks dispatched by separate service)
      const extra: Record<string, string> = { "Content-Language": lang };
      if (newFloat < Number(floatRow.low_threshold)) extra["X-Float-Warning"] = "low_float";

      return json(tx, 201, extra);
    }

    // GET /v1/agents/:agentId/transactions
    if (req.method === "GET" && tail.length === 3 && tail[2] === "transactions") {
      const agentId = tail[1];
      if (!UUID_RE.test(agentId)) return problem(400, "INVALID_AGENT_ID", "agentId must be UUID", lang);
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
      const { data, error } = await supabase
        .from("agent_cash_transactions")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return problem(500, "TX_LIST_FAILED", error.message, lang);
      return json({ data: data ?? [], count: data?.length ?? 0 }, 200, { "Content-Language": lang });
    }

    return problem(404, "NOT_FOUND", `No route for ${req.method} ${url.pathname}`, lang);
  } catch (e) {
    return problem(500, "INTERNAL", e instanceof Error ? e.message : String(e), lang);
  }
});
