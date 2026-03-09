import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const flwKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const { account_number, account_bank } = await req.json();

    if (!account_number || !account_bank) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'account_number and account_bank are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${flwKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number, account_bank }),
    });
    const data = await res.json();

    if (data.status !== 'success') throw new Error(data.message || 'Verification failed');

    return new Response(JSON.stringify({ account_name: data.data.account_name, account_number: data.data.account_number }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] verify-bank-account error:`, err);
    return new Response(JSON.stringify({ error: 'verification_failed', error_id: errorId }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
