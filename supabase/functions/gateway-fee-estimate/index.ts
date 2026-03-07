// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateGatewayFee } from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const amount = parseFloat(url.searchParams.get('amount') || '0');
    const channel = url.searchParams.get('channel') || 'mobile_money';
    const currency = url.searchParams.get('currency') || 'XAF';
    const merchantId = url.searchParams.get('merchant_id') || undefined;
    const institutionId = url.searchParams.get('institution_id') || undefined;

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'amount must be a positive number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const result = await calculateGatewayFee(amount, channel, supabase, { merchantId, institutionId });

    return new Response(JSON.stringify({
      amount,
      currency,
      channel,
      fee_amount: result.fee,
      net_amount: result.net,
      fee_breakdown: {
        rate: `${((result.fee) / amount * 100).toFixed(1)}%`,
        currency,
      },
      limits: result.limits || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
