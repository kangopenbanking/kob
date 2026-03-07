import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get metrics for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Transaction metrics
    const { data: transactions, count: transactionCount } = await adminSupabase
      .from('transactions')
      .select('amount, currency', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo);

    // Payment metrics
    const { count: paymentCount } = await adminSupabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    // API usage metrics
    const { count: apiCallCount } = await adminSupabase
      .from('api_usage_metrics')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    // Active consents
    const { count: activeConsentsCount } = await adminSupabase
      .from('aisp_consents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Authorised');

    // Active users (with recent activity)
    const { count: activeUsersCount } = await adminSupabase
      .from('transactions')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    // Total transaction volume
    const totalVolume = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // API performance metrics
    const { data: apiMetrics } = await adminSupabase
      .from('api_usage_metrics')
      .select('response_time_ms, status_code')
      .gte('created_at', thirtyDaysAgo);

    const avgResponseTime = apiMetrics?.length 
      ? apiMetrics.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / apiMetrics.length
      : 0;

    const successRate = apiMetrics?.length
      ? (apiMetrics.filter(m => m.status_code >= 200 && m.status_code < 300).length / apiMetrics.length) * 100
      : 0;

    return new Response(
      JSON.stringify({
        period: {
          start: thirtyDaysAgo,
          end: new Date().toISOString(),
        },
        transactions: {
          count: transactionCount || 0,
          volume: totalVolume,
          currency: 'XAF',
        },
        payments: {
          count: paymentCount || 0,
        },
        api: {
          totalCalls: apiCallCount || 0,
          avgResponseTime: Math.round(avgResponseTime),
          successRate: Math.round(successRate * 100) / 100,
        },
        consents: {
          active: activeConsentsCount || 0,
        },
        users: {
          active: activeUsersCount || 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-metrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
