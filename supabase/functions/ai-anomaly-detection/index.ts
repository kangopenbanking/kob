import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting AI anomaly detection...');

    // Fetch recent API usage metrics (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: metrics, error: metricsError } = await supabase
      .from('api_usage_metrics')
      .select('*')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (metricsError) throw metricsError;

    if (!metrics || metrics.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No data available for analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate metrics for AI analysis
    const endpointStats: Record<string, any> = {};
    const clientStats: Record<string, any> = {};
    let totalErrors = 0;
    let totalRequests = metrics.length;

    metrics.forEach(metric => {
      // Endpoint stats
      const endpoint = metric.endpoint || 'unknown';
      if (!endpointStats[endpoint]) {
        endpointStats[endpoint] = {
          requests: 0,
          errors: 0,
          total_response_time: 0,
          status_codes: {} as Record<number, number>
        };
      }
      endpointStats[endpoint].requests++;
      endpointStats[endpoint].total_response_time += metric.response_time_ms || 0;
      endpointStats[endpoint].status_codes[metric.status_code] = 
        (endpointStats[endpoint].status_codes[metric.status_code] || 0) + 1;
      if (metric.status_code >= 400) {
        endpointStats[endpoint].errors++;
        totalErrors++;
      }

      // Client stats
      const clientId = metric.client_id || 'unknown';
      if (!clientStats[clientId]) {
        clientStats[clientId] = { requests: 0, errors: 0 };
      }
      clientStats[clientId].requests++;
      if (metric.status_code >= 400) clientStats[clientId].errors++;
    });

    // Prepare data summary for AI
    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]: [string, any]) => ({
        endpoint,
        requests: stats.requests,
        error_rate: ((stats.errors / stats.requests) * 100).toFixed(2),
        avg_response_time: (stats.total_response_time / stats.requests).toFixed(2),
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    const suspiciousClients = Object.entries(clientStats)
      .map(([client, stats]: [string, any]) => ({
        client,
        requests: stats.requests,
        error_rate: ((stats.errors / stats.requests) * 100).toFixed(2),
      }))
      .filter((c: any) => c.requests > 100 || parseFloat(c.error_rate) > 20)
      .sort((a, b) => parseFloat(b.error_rate) - parseFloat(a.error_rate));

    const analysisPrompt = `Analyze this API usage data from the last 24 hours and identify anomalies or suspicious patterns:

Total Requests: ${totalRequests}
Total Errors: ${totalErrors}
Overall Error Rate: ${((totalErrors / totalRequests) * 100).toFixed(2)}%

Top 10 Endpoints by Traffic:
${topEndpoints.map(e => `- ${e.endpoint}: ${e.requests} requests, ${e.error_rate}% errors, ${e.avg_response_time}ms avg response time`).join('\n')}

Suspicious Clients (high volume or high error rate):
${suspiciousClients.length > 0 ? suspiciousClients.map((c: any) => `- Client ${c.client}: ${c.requests} requests, ${c.error_rate}% error rate`).join('\n') : 'None detected'}

Please identify:
1. Any unusual traffic patterns or spikes
2. Endpoints with abnormally high error rates
3. Clients showing suspicious behavior
4. Performance degradation issues
5. Potential security concerns

Provide actionable recommendations for each issue found.`;

    console.log('Sending data to Lovable AI for analysis...');

    // Call Lovable AI for analysis
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert API security analyst and anomaly detection specialist. Analyze API usage patterns and identify suspicious behavior, performance issues, and security threats. Provide specific, actionable recommendations.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    console.log('AI analysis completed');

    // Save analysis results
    const { error: insertError } = await supabase.from('ai_anomaly_reports').insert([{
      analysis_data: {
        total_requests: totalRequests,
        total_errors: totalErrors,
        top_endpoints: topEndpoints,
        suspicious_clients: suspiciousClients,
      },
      ai_analysis: analysis,
      anomalies_detected: suspiciousClients.length > 0 || (totalErrors / totalRequests) > 0.05,
    }]);

    if (insertError) {
      console.error('Failed to save analysis:', insertError);
    }

    // Create system alerts for critical issues
    if ((totalErrors / totalRequests) > 0.1) {
      await supabase.from('system_alerts').insert([{
        alert_type: 'high_error_rate',
        message: `Critical: System-wide error rate is ${((totalErrors / totalRequests) * 100).toFixed(2)}%`,
        severity: 'critical',
        status: 'active',
        metadata: { error_count: totalErrors, total_requests: totalRequests }
      }]);
    }

    if (suspiciousClients.length > 0) {
      for (const client of suspiciousClients.slice(0, 3)) {
        await supabase.from('system_alerts').insert([{
          alert_type: 'suspicious_client_activity',
          message: `Suspicious activity detected from client ${client.client}: ${client.requests} requests with ${client.error_rate}% error rate`,
          severity: 'warning',
          status: 'active',
          metadata: client
        }]);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        summary: {
          total_requests: totalRequests,
          total_errors: totalErrors,
          error_rate: ((totalErrors / totalRequests) * 100).toFixed(2),
          anomalies_detected: suspiciousClients.length,
          top_endpoints: topEndpoints.slice(0, 5),
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to run anomaly detection',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
