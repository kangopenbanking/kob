// Consolidated router for Flutterwave utilities: list-banks, verify-bank
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const fnMap: Record<string, string> = {
      'list-banks': 'flutterwave-list-banks',
      'verify-bank': 'flutterwave-verify-bank',
    };

    const targetFn = fnMap[action];
    if (!targetFn) return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const res = await fetch(`${supabaseUrl}/functions/v1/${targetFn}`, {
      method: req.method,
      headers: { ...Object.fromEntries(req.headers.entries()), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const responseBody = await res.text();
    return new Response(responseBody, { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('flutterwave-utils error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});