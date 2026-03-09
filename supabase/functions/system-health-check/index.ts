import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const healthChecks = [];

    // Check Database
    const dbStart = Date.now();
    try {
      const { error: dbError } = await supabase.from('profiles').select('count').limit(1);
      const dbTime = Date.now() - dbStart;
      
      await supabase.from('system_health_checks').insert({
        service_name: 'database',
        status: dbError ? 'down' : (dbTime > 1000 ? 'degraded' : 'healthy'),
        response_time_ms: dbTime,
        error_message: dbError?.message,
        metadata: { check_type: 'query' }
      });

      healthChecks.push({
        service: 'database',
        status: dbError ? 'down' : (dbTime > 1000 ? 'degraded' : 'healthy'),
        responseTime: dbTime
      });
    } catch (error: any) {
      healthChecks.push({
        service: 'database',
        status: 'down',
        error: error.message
      });
    }

    // Check JWKS Endpoint
    const jwksStart = Date.now();
    try {
      const jwksResponse = await fetch(`${supabaseUrl}/functions/v1/jwks-endpoint`);
      const jwksTime = Date.now() - jwksStart;
      
      await supabase.from('system_health_checks').insert({
        service_name: 'jwks-endpoint',
        status: jwksResponse.ok ? (jwksTime > 2000 ? 'degraded' : 'healthy') : 'down',
        response_time_ms: jwksTime,
        error_message: jwksResponse.ok ? null : `HTTP ${jwksResponse.status}`,
        metadata: { check_type: 'http' }
      });

      healthChecks.push({
        service: 'jwks-endpoint',
        status: jwksResponse.ok ? (jwksTime > 2000 ? 'degraded' : 'healthy') : 'down',
        responseTime: jwksTime
      });
    } catch (error: any) {
      healthChecks.push({
        service: 'jwks-endpoint',
        status: 'down',
        error: error.message
      });
    }

    // Check OIDC Config Endpoint
    const oidcStart = Date.now();
    try {
      const oidcResponse = await fetch(`${supabaseUrl}/functions/v1/oidc-config`);
      const oidcTime = Date.now() - oidcStart;
      
      await supabase.from('system_health_checks').insert({
        service_name: 'oidc-config',
        status: oidcResponse.ok ? (oidcTime > 2000 ? 'degraded' : 'healthy') : 'down',
        response_time_ms: oidcTime,
        error_message: oidcResponse.ok ? null : `HTTP ${oidcResponse.status}`,
        metadata: { check_type: 'http' }
      });

      healthChecks.push({
        service: 'oidc-config',
        status: oidcResponse.ok ? (oidcTime > 2000 ? 'degraded' : 'healthy') : 'down',
        responseTime: oidcTime
      });
    } catch (error: any) {
      healthChecks.push({
        service: 'oidc-config',
        status: 'down',
        error: error.message
      });
    }

    // Check for critical errors in recent API calls
    const { data: recentErrors } = await supabase
      .from('api_usage_metrics')
      .select('*')
      .gte('status_code', 500)
      .gte('created_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
      .limit(10);

    if (recentErrors && recentErrors.length > 5) {
      await supabase.from('system_alerts').insert({
        alert_type: 'error',
        severity: 'warning',
        message: `High error rate detected: ${recentErrors.length} 5xx errors in last 5 minutes`,
        details: { error_count: recentErrors.length, sample: recentErrors.slice(0, 3) }
      });
    }

    // Overall system status
    const allHealthy = healthChecks.every(check => check.status === 'healthy');
    const anyDown = healthChecks.some(check => check.status === 'down');
    const overallStatus = anyDown ? 'down' : (allHealthy ? 'healthy' : 'degraded');

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: healthChecks
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error: any) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
