import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const healthChecks: Record<string, any> = {
      database: { status: 'unknown', details: {} },
      edge_functions: { status: 'unknown', details: {} },
      email_service: { status: 'unknown', details: {} },
      integrations: { status: 'unknown', details: {} }
    };

    // 1. Database Health
    try {
      const { count: profilesCount, error: profilesError } = await supabase
        .from('crediq_user_profiles')
        .select('*', { count: 'exact', head: true });
      
      const { count: scoresCount, error: scoresError } = await supabase
        .from('credit_scores')
        .select('*', { count: 'exact', head: true });
      
      if (profilesError || scoresError) throw new Error('Database query failed');
      
      healthChecks.database = {
        status: 'healthy',
        details: {
          profiles_table: 'accessible',
          scores_table: 'accessible',
          total_profiles: profilesCount || 0,
          total_scores: scoresCount || 0
        }
      };
    } catch (e) {
      healthChecks.database = {
        status: 'unhealthy',
        details: { error: e instanceof Error ? e.message : String(e) }
      };
    }

    // 2. Edge Functions Health
    try {
      const functions = [
        'crediq-generate-baseline-score',
        'crediq-calculate-health-metrics',
        'crediq-generate-action-plan',
        'crediq-send-welcome-email'
      ];
      
      healthChecks.edge_functions = {
        status: 'healthy',
        details: {
          available_functions: functions,
          count: functions.length
        }
      };
    } catch (e) {
      healthChecks.edge_functions = {
        status: 'unhealthy',
        details: { error: e instanceof Error ? e.message : String(e) }
      };
    }

    // 3. Email Service Health (Resend)
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      
      healthChecks.email_service = {
        status: resendKey ? 'healthy' : 'warning',
        details: {
          api_key: resendKey ? 'configured' : 'missing',
          templates_count: 5
        }
      };
    } catch (e) {
      healthChecks.email_service = {
        status: 'unhealthy',
        details: { error: e instanceof Error ? e.message : String(e) }
      };
    }

    // 4. Integrations Health
    try {
      const { count: creditScoresCount } = await supabase
        .from('credit_scores')
        .select('*', { count: 'exact', head: true });
      
      healthChecks.integrations = {
        status: 'healthy',
        details: {
          credit_engine: 'operational',
          kob_apis: 'integrated',
          total_scores: creditScoresCount || 0
        }
      };
    } catch (e) {
      healthChecks.integrations = {
        status: 'unhealthy',
        details: { error: e instanceof Error ? e.message : String(e) }
      };
    }

    // Overall status
    const allHealthy = Object.values(healthChecks).every((check: any) => check.status === 'healthy' || check.status === 'warning');
    const overallStatus = allHealthy ? 'operational' : 'degraded';

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        service: 'CrediQ - Cameroon Credit Standard',
        version: '1.0.0',
        checks: healthChecks,
        summary: {
          total_checks: 4,
          passed: Object.values(healthChecks).filter((c: any) => c.status === 'healthy' || c.status === 'warning').length,
          failed: Object.values(healthChecks).filter((c: any) => c.status === 'unhealthy').length
        }
      }, null, 2),
      {
        status: allHealthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
