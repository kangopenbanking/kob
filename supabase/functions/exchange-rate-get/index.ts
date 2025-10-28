import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const from = url.searchParams.get('from') || 'XAF';
    const to = url.searchParams.get('to') || 'USD';

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
          from: from,
          to: to,
          rate: parseFloat(cachedRate.rate),
          source: 'cache',
          cached_at: cachedRate.created_at,
          valid_until: cachedRate.valid_until
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Fetch from Frankfurter API
    console.log('Fetching from Frankfurter API...');
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate from API');
    }

    const data = await response.json();
    const rate = data.rates[to];

    if (!rate) {
      throw new Error('Exchange rate not available for this currency pair');
    }

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

    console.log('Rate fetched and cached:', rate);

    return new Response(
      JSON.stringify({
        from: from,
        to: to,
        rate: rate,
        source: 'api',
        fetched_at: new Date().toISOString(),
        valid_until: validUntil,
        api_date: data.date
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in exchange-rate-get:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'EXCHANGE_RATE_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
