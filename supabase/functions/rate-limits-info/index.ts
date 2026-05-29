/**
 * /v1/rate-limits — Published per-tier rate limits.
 *
 * Mirrors enforcement values used by the API gateway. Surfaced so SDKs and
 * dashboards can render the matrix without scraping docs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { extractTraceContext, tracingResponseHeaders } from "../_shared/tracing.ts";

const TIERS = [
  { tier: "free", requests_per_minute: 60, burst: 120, concurrent_connections: 10, webhook_deliveries_per_minute: 30, idempotency_window_hours: 24 },
  { tier: "pro", requests_per_minute: 600, burst: 1200, concurrent_connections: 100, webhook_deliveries_per_minute: 300, idempotency_window_hours: 24 },
  { tier: "enterprise", requests_per_minute: 6000, burst: 12000, concurrent_connections: 1000, webhook_deliveries_per_minute: 3000, idempotency_window_hours: 168 },
];

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const trace = extractTraceContext(req);
  return new Response(JSON.stringify({ data: TIERS }), {
    status: 200,
    headers: {
      ...corsHeaders,
      ...tracingResponseHeaders(trace),
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
