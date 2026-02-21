import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'amount must be a positive number' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { fee, net } = calculateGatewayFee(amount, channel);

    return new Response(JSON.stringify({
      amount,
      currency,
      channel,
      fee_amount: fee,
      net_amount: net,
      fee_breakdown: {
        rate: channel === 'mobile_money' ? '3%' : channel === 'card' ? '3.5%' : '2%',
        fixed: channel === 'mobile_money' ? 50 : channel === 'card' ? 100 : 75,
        currency,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
