import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * XAF & XOF are pegged to EUR at fixed rates by the CFA franc treaty.
 * Frankfurter API (ECB data) does NOT support XAF/XOF directly.
 * We solve this by converting through EUR as an intermediary.
 */
const EUR_PEGGED: Record<string, number> = {
  XAF: 655.957,  // 1 EUR = 655.957 XAF (CEMAC)
  XOF: 655.957,  // 1 EUR = 655.957 XOF (UEMOA)
  CDF: 0,        // Not pegged — skip
  GNF: 0,        // Not pegged — skip
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const from = url.searchParams.get('from') || 'GBP';
    const to = url.searchParams.get('to') || 'XAF';

    console.log('Exchange rate request:', { from, to });

    // Check cache first (valid for 1 hour)
    const { data: cachedRate } = await supabase
      .from('exchange_rates_cache')
      .select('*')
      .eq('base_currency', from)
      .eq('target_currency', to)
      .eq('rate_source', 'frankfurter')
      .gt('valid_until', new Date().toISOString())
      .single();

    if (cachedRate) {
      console.log('Using cached rate:', cachedRate.rate);
      return new Response(
        JSON.stringify({
          from, to,
          rate: parseFloat(cachedRate.rate),
          source: 'cache',
          cached_at: cachedRate.created_at,
          valid_until: cachedRate.valid_until
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let rate: number | null = null;
    let apiDate: string | null = null;

    const fromPegged = EUR_PEGGED[from] ?? null;
    const toPegged = EUR_PEGGED[to] ?? null;

    if (from === to) {
      // Same currency
      rate = 1;
    } else if (fromPegged && fromPegged > 0 && toPegged && toPegged > 0) {
      // Both pegged to EUR (e.g., XAF → XOF)
      rate = toPegged / fromPegged;
    } else if (toPegged && toPegged > 0) {
      // Target is pegged (e.g., GBP → XAF): get GBP→EUR, then multiply by peg
      if (from === 'EUR') {
        // EUR → XAF: just use the peg directly
        rate = toPegged;
      } else {
        const eurRate = await fetchFrankfurter(from, 'EUR');
        if (eurRate) {
          rate = eurRate.rate * toPegged;
          apiDate = eurRate.date;
        }
      }
    } else if (fromPegged && fromPegged > 0) {
      // Source is pegged (e.g., XAF → GBP): get EUR→GBP, then divide by peg
      const eurRate = await fetchFrankfurter('EUR', to);
      if (eurRate) {
        rate = eurRate.rate / fromPegged;
        apiDate = eurRate.date;
      }
    } else {
      // Neither is pegged — direct Frankfurter lookup
      const result = await fetchFrankfurter(from, to);
      if (result) {
        rate = result.rate;
        apiDate = result.date;
      }
    }

    if (rate === null || rate === undefined) {
      return new Response(
        JSON.stringify({ error: 'Exchange rate not available for this currency pair', code: 'RATE_NOT_AVAILABLE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Round to 6 decimal places for precision
    rate = Math.round(rate * 1000000) / 1000000;

    // Cache the rate for 1 hour
    const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase
      .from('exchange_rates_cache')
      .upsert({
        base_currency: from,
        target_currency: to,
        rate: rate,
        rate_source: 'frankfurter',
        valid_until: validUntil,
      });

    console.log('Rate fetched and cached:', { from, to, rate });

    return new Response(
      JSON.stringify({
        from, to, rate,
        source: 'api',
        fetched_at: new Date().toISOString(),
        valid_until: validUntil,
        api_date: apiDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in exchange-rate-get:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, code: 'EXCHANGE_RATE_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function fetchFrankfurter(from: string, to: string): Promise<{ rate: number; date: string } | null> {
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    if (!response.ok) return null;
    const data = await response.json();
    const rate = data.rates?.[to];
    if (!rate) return null;
    return { rate, date: data.date };
  } catch {
    return null;
  }
}
