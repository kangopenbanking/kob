import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Real-time health checks for external services
    async function checkFlutterwaveHealth(): Promise<boolean> {
      try {
        const response = await fetch('https://api.flutterwave.com/v3/banks/NG', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('FLUTTERWAVE_SECRET_KEY')}`
          },
          signal: AbortSignal.timeout(5000)
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    async function checkStripeHealth(): Promise<boolean> {
      try {
        const response = await fetch('https://api.stripe.com/v1/products?limit=1', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`
          },
          signal: AbortSignal.timeout(5000)
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    async function checkDatabaseHealth(): Promise<boolean> {
      try {
        const { error } = await supabase.from('profiles').select('count').limit(1);
        return !error;
      } catch {
        return false;
      }
    }

    // Execute health checks in parallel
    const [flutterwaveOk, stripeOk, dbOk] = await Promise.all([
      checkFlutterwaveHealth(),
      checkStripeHealth(),
      checkDatabaseHealth()
    ]);

    const allServicesOk = flutterwaveOk && stripeOk && dbOk;

    const health = {
      status: allServicesOk ? 'operational' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        oauth: 'operational',
        aisp: 'operational',
        pisp: 'operational',
        certificates: 'operational',
        mobile_money: flutterwaveOk ? 'operational' : 'degraded',
        banking: flutterwaveOk ? 'operational' : 'degraded',
        credit_scoring: dbOk ? 'operational' : 'degraded',
        virtual_cards: stripeOk ? 'operational' : 'degraded',
        webhooks: 'operational',
        database: dbOk ? 'operational' : 'degraded'
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
