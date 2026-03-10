// Consolidated router for PIN management: set, verify, reset, password-reset-with-pin
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Route to original individual functions via internal fetch
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const fnMap: Record<string, string> = {
      'set': 'pin-code-set',
      'verify': 'pin-code-verify',
      'reset': 'pin-code-reset',
      'password-reset': 'password-reset-with-pin',
    };

    const targetFn = fnMap[action];
    if (!targetFn) return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const res = await fetch(`${supabaseUrl}/functions/v1/${targetFn}`, {
      method: 'POST',
      headers: { ...Object.fromEntries(req.headers.entries()), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const responseBody = await res.text();
    return new Response(responseBody, { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('pin-mgmt error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});