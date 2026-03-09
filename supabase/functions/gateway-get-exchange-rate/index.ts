import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || 'XAF';
    const to = url.searchParams.get('to') || 'USD';
    const amount = parseFloat(url.searchParams.get('amount') || '1');

    const fxRes = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}&amount=${amount}`);
    if (!fxRes.ok) {
      return new Response(JSON.stringify({ error: 'fx_lookup_failed', message: 'Unable to fetch exchange rate' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const fxData = await fxRes.json();
    const rate = fxData.rates?.[to];

    return new Response(JSON.stringify({
      from,
      to,
      rate,
      amount,
      converted: rate ? Math.round(amount * rate * 100) / 100 : null,
      timestamp: new Date().toISOString(),
      source: 'frankfurter',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] exchange-rate error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
