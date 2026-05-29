/**
 * /v1/consents — Unified consent lifecycle façade.
 *
 * Routes to the existing rail-specific consent functions without breaking them:
 *   - AISP   → aisp-create-consent / consent-status / consent-revoke / consent-extend
 *   - PISP   → pisp-create-consent
 *   - CBPII  → reserved for future card-based confirmation of funds
 *
 * Reference: Berlin Group NextGenPSD2 v1.3.6 §5 — Consent lifecycle.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { extractTraceContext, tracingResponseHeaders, withTracingFetch } from "../_shared/tracing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  type?: "AISP" | "PISP" | "CBPII";
  permissions?: string[];
  expiration_date?: string;
  transaction_from_date?: string;
  transaction_to_date?: string;
  psu_identifier?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const trace = extractTraceContext(req);
  const traceHeaders = tracingResponseHeaders(trace);
  const tracedFetch = withTracingFetch(trace);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // Expected shapes: /consents-lifecycle, /consents-lifecycle/:id, /consents-lifecycle/:id/extend
  const consentId = parts[1];
  const action = parts[2];

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, ...traceHeaders, "Content-Type": "application/json" },
    });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ type: "https://docs.kangopenbanking.com/errors/unauthorized", title: "Unauthorized", status: 401 }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ title: "Unauthorized", status: 401 }, 401);

    // LIST
    if (req.method === "GET" && !consentId) {
      let q = supabase.from("consents").select("*").eq("user_id", userData.user.id).order("created_at", { ascending: false }).limit(Number(url.searchParams.get("limit") || 25));
      const type = url.searchParams.get("type");
      const status = url.searchParams.get("status");
      if (type) q = q.eq("consent_type", type);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return json({ data: data || [], next_cursor: null });
    }

    // GET
    if (req.method === "GET" && consentId) {
      const { data, error } = await supabase.from("consents").select("*").eq("id", consentId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ title: "Not Found", status: 404 }, 404);
      return json(data);
    }

    // CREATE
    if (req.method === "POST" && !consentId) {
      const body = (await req.json()) as Body;
      if (!body.type || !body.permissions?.length) {
        return json({ title: "Validation Failed", status: 422, detail: "type and permissions are required" }, 422);
      }
      const rail = body.type === "PISP" ? "pisp-create-consent" : "aisp-create-consent";
      const upstream = await tracedFetch(`${SUPABASE_URL}/functions/v1/${rail}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await upstream.json().catch(() => ({}));
      return json(payload, upstream.status);
    }

    // REVOKE
    if (req.method === "DELETE" && consentId) {
      const upstream = await tracedFetch(`${SUPABASE_URL}/functions/v1/consent-revoke`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ consent_id: consentId }),
      });
      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return json(err, upstream.status);
      }
      return new Response(null, { status: 204, headers: { ...corsHeaders, ...traceHeaders } });
    }

    // EXTEND
    if (req.method === "POST" && consentId && action === "extend") {
      const body = await req.json().catch(() => ({}));
      const upstream = await tracedFetch(`${SUPABASE_URL}/functions/v1/consent-extend`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ consent_id: consentId, ...body }),
      });
      const payload = await upstream.json().catch(() => ({}));
      return json(payload, upstream.status);
    }

    return json({ title: "Method Not Allowed", status: 405 }, 405);
  } catch (e) {
    console.error("[consents-lifecycle]", e);
    return json({ title: "Internal Server Error", status: 500, detail: (e as Error).message }, 500);
  }
});
