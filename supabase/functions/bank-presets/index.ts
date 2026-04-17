// Public read-only catalog of bank profile presets.
// Order P1 (Public First): no auth required.
// Order 4 (Surgeon Rule): additive endpoint, does not touch existing flows.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const country = url.searchParams.get('country');
    const adapterType = url.searchParams.get('adapter_type');
    const certifiedOnly = url.searchParams.get('certified') === 'true';
    const bankCode = url.searchParams.get('bank_code');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );

    let query = supabase
      .from('bank_profile_presets')
      .select('bank_code,bank_name,country,swift_bic,recommended_adapter_type,default_config_json,documentation_url,integration_notes,certified,certified_at')
      .order('country', { ascending: true })
      .order('bank_name', { ascending: true });

    if (country) query = query.eq('country', country.toUpperCase());
    if (adapterType) query = query.eq('recommended_adapter_type', adapterType);
    if (certifiedOnly) query = query.eq('certified', true);
    if (bankCode) query = query.eq('bank_code', bankCode.toUpperCase());

    const { data, error } = await query;
    if (error) throw error;

    return new Response(
      JSON.stringify({
        count: data?.length ?? 0,
        presets: data ?? [],
        meta: {
          api_version: '4.16.0',
          documentation: 'https://kob.lovable.app/developer/connectors/cemac-bank-catalog',
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
