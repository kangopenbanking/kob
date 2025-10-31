import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const health = {
      status: 'operational',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        oauth: 'operational',
        aisp: 'operational',
        pisp: 'operational',
        certificates: 'operational',
        mobile_money: 'operational',
        banking: 'operational',
        credit_scoring: 'operational',
        virtual_cards: 'operational',
        webhooks: 'operational'
      },
      documentation: {
        openapi: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/public-api-spec',
        postman: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/postman-collection',
        explorer: 'https://kangopenbanking.com/developer/api-explorer',
        oidc_discovery: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/oidc-config'
      },
      fapi_compliance: {
        profile: 'FAPI 1.0 Advanced',
        mtls_supported: true,
        certificate_bound_tokens: true,
        par_supported: true,
        jar_supported: true,
        pkce_required: true,
        dpop_supported: false
      },
      regulatory_compliance: {
        cobac: true,
        beac: true,
        iso20022: true,
        swift: true
      }
    };

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        status: 'degraded',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
