import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the api-health endpoint
    const startTime = Date.now();
    let status: 'operational' | 'degraded' | 'down' = 'down';
    let errorMessage: string | null = null;

    try {
      const healthResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/api-health`);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (healthResponse.ok) {
        status = 'operational';
      } else {
        status = 'degraded';
        errorMessage = `HTTP ${healthResponse.status}`;
      }

      // Calculate uptime based on recent metrics
      const { data: recentMetrics } = await supabaseAdmin
        .from('api_health_metrics')
        .select('status')
        .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('checked_at', { ascending: false });

      let uptime = 99.9;
      if (recentMetrics && recentMetrics.length > 0) {
        const operationalCount = recentMetrics.filter(m => m.status === 'operational').length;
        uptime = (operationalCount / recentMetrics.length) * 100;
      }

      // Store the metric
      const { error: insertError } = await supabaseAdmin
        .from('api_health_metrics')
        .insert({
          status,
          response_time: responseTime,
          uptime: uptime.toFixed(2),
          error_message: errorMessage,
        });

      if (insertError) {
        console.error('Error inserting health metric:', insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          metric: {
            status,
            response_time: responseTime,
            uptime: uptime.toFixed(2),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Store the error metric
      await supabaseAdmin
        .from('api_health_metrics')
        .insert({
          status: 'down',
          response_time: responseTime,
          uptime: 0,
          error_message: errorMessage,
        });

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Health collector error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
