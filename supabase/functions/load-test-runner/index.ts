import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Admin authentication required
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return problem(401, 'Unauthorized', 'Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return problem(401, 'Unauthorized', 'Invalid or expired token');

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    if (!hasAdminRole) return problem(403, 'Forbidden', 'Admin access required');

    const { endpoint, concurrent_requests, duration_seconds, payload } = await req.json();

    // Safety limits
    const safeConcurrent = Math.min(concurrent_requests || 5, 50);
    const safeDuration = Math.min(duration_seconds || 5, 30);

    console.log(`[Load Test] Admin ${user.email} started: ${endpoint}, ${safeConcurrent} concurrent, ${safeDuration}s`);

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
          results.errors.push(`Status ${response.status}`);
        }
        results.status_codes[response.status] = (results.status_codes[response.status] || 0) + 1;
        await response.text().catch(() => null);
      } catch (error) {
        results.total_requests++;
        results.failed_requests++;
        results.errors.push('Request failed');
      }
    };

    const endTime = startTime + (safeDuration * 1000);
    const workers: Promise<void>[] = [];

    for (let i = 0; i < safeConcurrent; i++) {
      workers.push((async () => {
        while (Date.now() < endTime) {
          await makeRequest();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })());
    }

    await Promise.all(workers);

    const sorted = [...results.response_times].sort((a, b) => a - b);
    const len = sorted.length;
    const summary = {
      endpoint,
      concurrent_requests: safeConcurrent,
      duration_seconds: safeDuration,
      total_requests: results.total_requests,
      successful_requests: results.successful_requests,
      failed_requests: results.failed_requests,
      requests_per_second: len > 0 ? (results.total_requests / safeDuration).toFixed(2) : '0',
      success_rate: results.total_requests > 0 ? ((results.successful_requests / results.total_requests) * 100).toFixed(2) : '0',
      avg_response_time: len > 0 ? (sorted.reduce((a, b) => a + b, 0) / len).toFixed(2) : '0',
      min_response_time: len > 0 ? sorted[0] : 0,
      max_response_time: len > 0 ? sorted[len - 1] : 0,
      p95_response_time: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
      status_codes: results.status_codes,
      sample_errors: results.errors.slice(0, 5),
      run_by: user.email,
    };

    // Log results
    await supabase.from('load_test_results').insert([{
      endpoint,
      concurrent_requests: safeConcurrent,
      duration_seconds: safeDuration,
      results: summary,
    }]).catch(() => null);

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'load_test_executed',
      entity_type: 'load_test',
      entity_id: crypto.randomUUID(),
      performed_by: user.id,
      details: { endpoint, concurrent_requests: safeConcurrent, duration_seconds: safeDuration, total_requests: results.total_requests },
    }).catch(() => null);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SECURE] Load test error:', error instanceof Error ? error.message : String(error));
    return problem(500, 'Internal Server Error', 'Load test execution failed');
  }
});
