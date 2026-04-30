// PERMANENT PUBLIC ENDPOINT — DO NOT REMOVE OR GATE
// /v1/heartbeat — minimal uptime probe for status pages, monitors, and load balancers.
// Public, unauthenticated, sub-50ms response. Returns 200 + tiny JSON.
// For richer subsystem status, see /v1/status (api-status function) or /v1/healthz.
import { corsHeaders } from "../_shared/cors.ts";

const VERSION = "1.0.0";
const STARTED_AT = new Date().toISOString();

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Heartbeat-Version": VERSION,
      },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "GET, HEAD" },
    });
  }

  const body = {
    status: "ok",
    service: "kang-open-banking-api",
    version: VERSION,
    time: new Date().toISOString(),
    started_at: STARTED_AT,
    docs: "https://kangopenbanking.com/developer",
    status_page: "https://kangopenbanking.com/status",
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Heartbeat-Version": VERSION,
    },
  });
});
