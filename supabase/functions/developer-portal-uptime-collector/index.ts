// Developer portal uptime collector.
//
// Probes the public developer-portal pages and OpenAPI endpoints, then
// records one row per URL into `public.developer_portal_health` so the
// admin /healthz dashboard can surface trend data.
//
// Triggered by an external scheduler (cron) or manually via a service-role
// HTTP request. Writes use the service role; reads are RLS-gated to admins.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { corsHeaders } from '../_shared/cors.ts';

type ContentCheck =
  | 'pass'
  | 'leak:YOUR_PROJECT'
  | 'leak:supabase.co'
  | 'leak:ssr-fallback'
  | 'http-error'
  | 'fetch-error';

const PORTAL_URLS = [
  'https://kangopenbanking.com/developer',
  'https://kangopenbanking.com/developer/getting-started',
  'https://kangopenbanking.com/developer/api-explorer',
  'https://kangopenbanking.com/developer/gateway/quickstart',
  'https://kangopenbanking.com/developer/sandbox/overview',
  'https://kangopenbanking.com/developer/guides/sdks',
  'https://kangopenbanking.com/developer/examples/real-world',
  'https://kangopenbanking.com/developer/changelog',
  'https://kangopenbanking.com/openapi.json',
  'https://kangopenbanking.com/openapi.yaml',
  'https://kangopenbanking.com/.well-known/openid-configuration',
];

async function probe(url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    const ms = Date.now() - start;
    const body = await res.text();
    let contentCheck: ContentCheck = 'pass';
    if (!res.ok) contentCheck = 'http-error';
    else if (body.includes('YOUR_PROJECT')) contentCheck = 'leak:YOUR_PROJECT';
    else if (body.includes('supabase.co/functions/v1'))
      contentCheck = 'leak:supabase.co';
    else if (body.includes('<div id="ssr-fallback"'))
      contentCheck = 'leak:ssr-fallback';
    return {
      url,
      status: res.status,
      ok: res.ok && contentCheck === 'pass',
      content_check: contentCheck,
      response_ms: ms,
    };
  } catch (e) {
    return {
      url,
      status: 0,
      ok: false,
      content_check: 'fetch-error' as ContentCheck,
      response_ms: Date.now() - start,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const results = await Promise.all(PORTAL_URLS.map(probe));

  const { error } = await supabase
    .from('developer_portal_health')
    .insert(results);

  if (error) {
    console.error('insert failed:', error.message);
    return new Response(
      JSON.stringify({ ok: false, error: error.message, results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const failing = results.filter((r) => !r.ok);
  return new Response(
    JSON.stringify({
      ok: failing.length === 0,
      checked: results.length,
      failing: failing.length,
      results,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
