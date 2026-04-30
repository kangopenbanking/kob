import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    async function checkFlutterwaveHealth(): Promise<boolean> {
      try {
        const secretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
        if (!secretKey) return false;
        const response = await fetch('https://api.flutterwave.com/v3/banks/NG', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${secretKey}` },
          signal: AbortSignal.timeout(5000)
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    // Cardyfie health check removed — virtual_cards is dormant (coming soon)

    async function checkDatabaseHealth(): Promise<boolean> {
      try {
        const { error } = await supabase.from('profiles').select('count').limit(1);
        return !error;
      } catch {
        return false;
      }
    }

    async function checkOAuthHealth(): Promise<boolean> {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/oidc-config`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    async function checkAispHealth(): Promise<boolean> {
      try {
        const { error } = await supabase.from('aisp_consents').select('count').limit(1);
        return !error;
      } catch {
        return false;
      }
    }

    async function checkPispHealth(): Promise<boolean> {
      try {
        const { error } = await supabase.from('pisp_consents').select('count').limit(1);
        return !error;
      } catch {
        return false;
      }
    }

    // POS Commerce health — probes the core merchant storefront tables that
    // back products, orders, and store subscriptions. If any of these reads
    // fail, the POS Commerce surface (storefront, checkout, order capture)
    // cannot serve traffic and must report degraded.
    async function checkPosHealth(): Promise<boolean> {
      try {
        const [products, orders, stores] = await Promise.all([
          supabase.from('pos_products').select('id', { head: true, count: 'exact' }).limit(1),
          supabase.from('pos_orders').select('id', { head: true, count: 'exact' }).limit(1),
          supabase.from('pos_store_profiles').select('id', { head: true, count: 'exact' }).limit(1),
        ]);
        return !products.error && !orders.error && !stores.error;
      } catch {
        return false;
      }
    }

    const [flutterwaveOk, dbOk, oauthOk, aispOk, pispOk, posOk] = await Promise.all([
      checkFlutterwaveHealth(),
      checkDatabaseHealth(),
      checkOAuthHealth(),
      checkAispHealth(),
      checkPispHealth(),
      checkPosHealth(),
    ]);

    const allServicesOk = flutterwaveOk && dbOk && oauthOk && aispOk && pispOk && posOk;

    const health = {
      status: allServicesOk ? 'operational' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        oauth: oauthOk ? 'operational' : 'degraded',
        aisp: aispOk ? 'operational' : 'degraded',
        pisp: pispOk ? 'operational' : 'degraded',
        certificates: dbOk ? 'operational' : 'degraded',
        mobile_money: flutterwaveOk ? 'operational' : 'degraded',
        banking: flutterwaveOk ? 'operational' : 'degraded',
        credit_scoring: dbOk ? 'operational' : 'degraded',
        pos: posOk ? 'operational' : 'degraded',
        virtual_cards: 'dormant',
        webhooks: dbOk ? 'operational' : 'degraded',
        database: dbOk ? 'operational' : 'degraded'
      },
      documentation: (() => {
        const PUBLIC_API = Deno.env.get('PUBLIC_API_BASE_URL') ?? 'https://api.kangopenbanking.com/v1';
        const PUBLIC_SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://kangopenbanking.com';
        return {
          openapi: `${PUBLIC_API}/public-api-spec`,
          postman: `${PUBLIC_API}/postman-collection`,
          explorer: `${PUBLIC_SITE}/developer/api-explorer`,
          oidc_discovery: `${PUBLIC_API}/.well-known/openid-configuration`,
        };
      })(),
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
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
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
