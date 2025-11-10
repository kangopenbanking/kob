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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { endpoint, concurrent_requests, duration_seconds, payload } = await req.json();

    console.log(`Starting load test for ${endpoint}: ${concurrent_requests} concurrent requests for ${duration_seconds}s`);

    const startTime = Date.now();
    const results = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      response_times: [] as number[],
      errors: [] as string[],
      status_codes: {} as Record<number, number>,
    };

    const makeRequest = async (): Promise<void> => {
      const requestStartTime = Date.now();
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(payload || {}),
        });

        const responseTime = Date.now() - requestStartTime;
        results.response_times.push(responseTime);
        results.total_requests++;

        if (response.ok) {
          results.successful_requests++;
        } else {
          results.failed_requests++;
          results.errors.push(`Status ${response.status}: ${await response.text()}`);
        }

        results.status_codes[response.status] = (results.status_codes[response.status] || 0) + 1;
      } catch (error) {
        results.total_requests++;
        results.failed_requests++;
        results.errors.push(error instanceof Error ? error.message : String(error));
      }
    };

    // Run load test
    const endTime = startTime + (duration_seconds * 1000);
    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrent_requests; i++) {
      workers.push((async () => {
        while (Date.now() < endTime) {
          await makeRequest();
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })());
    }

    await Promise.all(workers);

    // Calculate statistics
    const avgResponseTime = results.response_times.length > 0
      ? results.response_times.reduce((a, b) => a + b, 0) / results.response_times.length
      : 0;

    const minResponseTime = results.response_times.length > 0
      ? Math.min(...results.response_times)
      : 0;

    const maxResponseTime = results.response_times.length > 0
      ? Math.max(...results.response_times)
      : 0;

    const p95ResponseTime = results.response_times.length > 0
      ? results.response_times.sort((a, b) => a - b)[Math.floor(results.response_times.length * 0.95)]
      : 0;

    const requestsPerSecond = results.total_requests / duration_seconds;
    const successRate = (results.successful_requests / results.total_requests) * 100;

    const summary = {
      endpoint,
      concurrent_requests,
      duration_seconds,
      total_requests: results.total_requests,
      successful_requests: results.successful_requests,
      failed_requests: results.failed_requests,
      requests_per_second: requestsPerSecond.toFixed(2),
      success_rate: successRate.toFixed(2),
      avg_response_time: avgResponseTime.toFixed(2),
      min_response_time: minResponseTime,
      max_response_time: maxResponseTime,
      p95_response_time: p95ResponseTime,
      status_codes: results.status_codes,
      sample_errors: results.errors.slice(0, 5),
    };

    // Log the test results
    await supabase.from('load_test_results').insert([{
      endpoint,
      concurrent_requests,
      duration_seconds,
      results: summary,
    }]);

    console.log('Load test completed:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Load test error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to run load test',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
