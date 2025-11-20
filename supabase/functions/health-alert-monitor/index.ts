import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Health alert monitor running...');

    // Query recent health metrics (last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('api_health_metrics')
      .select('*')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (metricsError) {
      throw metricsError;
    }

    if (!recentMetrics || recentMetrics.length === 0) {
      console.log('No recent health metrics found');
      return new Response(
        JSON.stringify({ message: 'No recent metrics to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Analyze for degradation patterns
    const degradedMetrics = recentMetrics.filter(m => m.status === 'degraded' || m.status === 'down');
    const consecutiveFailures = degradedMetrics.length;
    const failureRate = (degradedMetrics.length / recentMetrics.length) * 100;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.response_time, 0) / recentMetrics.length;

    const alerts = [];

    // Alert on consecutive failures (3 or more in 30 minutes)
    if (consecutiveFailures >= 3) {
      alerts.push({
        severity: consecutiveFailures >= 5 ? 'critical' : 'high',
        type: 'consecutive_failures',
        message: `API health check failed ${consecutiveFailures} times in the last 30 minutes`,
        metric_count: consecutiveFailures,
        recommended_action: 'Investigate external service status (Flutterwave, Stripe, Database)'
      });
    }

    // Alert on high failure rate (>30%)
    if (failureRate > 30) {
      alerts.push({
        severity: failureRate > 60 ? 'critical' : 'medium',
        type: 'high_failure_rate',
        message: `API health check failure rate is ${failureRate.toFixed(1)}%`,
        failure_rate: failureRate,
        recommended_action: 'Check network connectivity and external service availability'
      });
    }

    // Alert on slow response times (>2000ms average)
    if (avgResponseTime > 2000) {
      alerts.push({
        severity: avgResponseTime > 5000 ? 'high' : 'medium',
        type: 'slow_response',
        message: `Average API response time is ${avgResponseTime.toFixed(0)}ms`,
        avg_response_time: avgResponseTime,
        recommended_action: 'Investigate database performance and external API latency'
      });
    }

    // Send alerts if any detected
    if (alerts.length > 0) {
      console.log('Health alerts detected:', alerts);

      // Store alerts in system_alerts table
      for (const alert of alerts) {
        await supabase.from('system_alerts').insert({
          alert_type: 'api_health',
          severity: alert.severity,
          message: alert.message,
          details: alert,
          status: 'active',
          created_at: new Date().toISOString()
        });
      }

      // Send email notification to admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(email)')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        
        for (const admin of admins) {
          const profile = admin.profiles as any;
          await supabase.functions.invoke('send-communication', {
            body: {
              recipient: profile?.email || '',
              subject: criticalAlerts.length > 0 
                ? '🚨 CRITICAL: API Health Alert' 
                : '⚠️ API Health Warning',
              body: `
                <h2>API Health Alert Detected</h2>
                <p>The automated health monitoring system has detected the following issues:</p>
                <ul>
                  ${alerts.map(a => `<li><strong>${a.severity.toUpperCase()}</strong>: ${a.message}</li>`).join('')}
                </ul>
                <h3>Recommended Actions:</h3>
                <ul>
                  ${alerts.map(a => `<li>${a.recommended_action}</li>`).join('')}
                </ul>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p>Please investigate immediately.</p>
              `,
              type: 'system_alert'
            }
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          alerts_sent: alerts.length,
          alerts: alerts
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('No health alerts detected. System operational.');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'No alerts detected. System healthy.',
        metrics_analyzed: recentMetrics.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Health alert monitor error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to monitor health',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});