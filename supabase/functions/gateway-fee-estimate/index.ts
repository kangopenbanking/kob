import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculateGatewayFee } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Create admin client for DB lookup
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { fee, net } = await calculateGatewayFee(amount, channel, supabase, { merchantId, institutionId });

    return new Response(JSON.stringify({
      amount,
      currency,
      channel,
      fee_amount: fee,
      net_amount: net,
      fee_breakdown: {
        rate: `${((fee - 0) / amount * 100).toFixed(1)}%`,
        currency,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
