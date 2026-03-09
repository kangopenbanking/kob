import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

/**
 * /v1/ready — Lightweight readiness probe.
 * Returns 200 if the API can reach the database, 503 otherwise.
 * No authentication required so load-balancers / uptime monitors can call it.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Minimal DB round-trip — single row, tiny table
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    const latencyMs = Date.now() - start;

    if (error) {
      return new Response(
        JSON.stringify({
          status: 'unavailable',
          timestamp: new Date().toISOString(),
          latency_ms: latencyMs,
          error: error.message,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        latency_ms: latencyMs,
        version: 'v1',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - start,
        error: err.message,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    );
  }
});
