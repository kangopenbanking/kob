// Consolidated router for phone auth: send-otp, verify-otp, pin-login, check-pin
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Dynamically import the original function's logic
    switch (action) {
      case 'send-otp':
      case 'verify-otp':
      case 'pin-login':
      case 'check-pin': {
        // Route to the original individual function via internal fetch
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const targetFn = `phone-auth-${action}`;
        const res = await fetch(`${supabaseUrl}/functions/v1/${targetFn}`, {
          method: 'POST',
          headers: { ...Object.fromEntries(req.headers.entries()), 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const responseBody = await res.text();
        return new Response(responseBody, { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('phone-auth error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});