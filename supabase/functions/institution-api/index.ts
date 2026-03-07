import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { 
  validateUserRole, 
  errorResponse, 
  logApiAccess,
  checkRateLimit 
} from "../_shared/role-middleware.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validate user role - must be institution
    const validation = await validateUserRole(req, ['institution', 'admin']);
    
    if (!validation.valid) {
      return errorResponse(corsHeaders, 401, 'Unauthorized', validation.error);
    }

    const { userId, roles, institutionId } = validation;

    // Rate limiting check
    const rateLimit = await checkRateLimit(userId!, 1000, 3600); // 1000 requests per hour
    if (!rateLimit.allowed) {
      return errorResponse(corsHeaders, 429, 'Rate limit exceeded', 
        `Try again later. Remaining: ${rateLimit.remaining}`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let responseData: any = {};
    let statusCode = 200;

    switch (action) {
      case 'dashboard': {
        // Get institution dashboard data
        const { data: institution } = await supabase
          .from('institutions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!institution) {
          return errorResponse(corsHeaders, 404, 'Institution not found');
        }

        // Get accounts
        const { data: accounts, count: accountCount } = await supabase
          .from('accounts')
          .select('*', { count: 'exact' })
          .eq('institution_id', institution.id);

        // Get recent transactions
        const accountIds = accounts?.map(a => a.id) || [];
        let transactionCount = 0;
        let totalVolume = 0;

        if (accountIds.length > 0) {
          const { data: transactions, count } = await supabase
            .from('transactions')
            .select('amount', { count: 'exact' })
            .in('account_id', accountIds)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          transactionCount = count || 0;
          totalVolume = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        }

        // Get API usage
        const { count: apiCallCount } = await supabase
          .from('api_usage_metrics')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', institution.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        responseData = {
          institution,
          metrics: {
            accounts: accountCount || 0,
            transactions: transactionCount,
            volume: totalVolume,
            apiCalls: apiCallCount || 0
          }
        };
        break;
      }

      case 'transactions': {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type');

        // Get institution accounts
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id')
          .eq('institution_id', institutionId);

        const accountIds = accounts?.map(a => a.id) || [];

        if (accountIds.length === 0) {
          responseData = { transactions: [], total: 0, page, limit };
          break;
        }

        let query = supabase
          .from('transactions')
          .select('*', { count: 'exact' })
          .in('account_id', accountIds);

        if (status) query = query.eq('status', status);
        if (type) query = query.eq('credit_debit_indicator', type === 'credit' ? 'Credit' : 'Debit');

        const from = (page - 1) * limit;
        const { data, count, error } = await query
          .order('booking_datetime', { ascending: false })
          .range(from, from + limit - 1);

        if (error) throw error;

        responseData = {
          transactions: data || [],
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit)
        };
        break;
      }

      case 'api-clients': {
        const { data: clients, error } = await supabase
          .from('api_clients')
          .select('id, client_id, client_name, scopes, grant_types, redirect_uris, is_active, created_at, expires_at')
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        responseData = { clients: clients || [] };
        break;
      }

      case 'analytics': {
        const period = parseInt(url.searchParams.get('period') || '30');
        const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        // Get accounts
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id')
          .eq('institution_id', institutionId);

        const accountIds = accounts?.map(a => a.id) || [];

        // Get transactions
        let transactions: any[] = [];
        if (accountIds.length > 0) {
          const { data } = await supabase
            .from('transactions')
            .select('amount, booking_datetime, credit_debit_indicator, status')
            .in('account_id', accountIds)
            .gte('booking_datetime', startDate);
          transactions = data || [];
        }

        // Get API usage
        const { data: apiUsage } = await supabase
          .from('api_usage_metrics')
          .select('endpoint, status_code, created_at')
          .eq('institution_id', institutionId)
          .gte('created_at', startDate);

        // Calculate metrics
        const totalVolume = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

        // Group by day
        const byDay: Record<string, { count: number; volume: number }> = {};
        transactions.forEach(t => {
          const date = t.booking_datetime?.split('T')[0] || 'unknown';
          if (!byDay[date]) byDay[date] = { count: 0, volume: 0 };
          byDay[date].count++;
          byDay[date].volume += Number(t.amount);
        });

        responseData = {
          summary: {
            totalTransactions: transactions.length,
            totalVolume,
            totalApiCalls: apiUsage?.length || 0,
            period
          },
          transactionsByDay: Object.entries(byDay)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          apiUsage: apiUsage || []
        };
        break;
      }

      default:
        return errorResponse(corsHeaders, 400, 'Invalid action', 
          'Valid actions: dashboard, transactions, api-clients, analytics');
    }

    // Log API access
    await logApiAccess(userId!, `/institution-api?action=${action}`, req.method, statusCode, institutionId);

    const responseTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      ...responseData,
      meta: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Institution API error:', error);
    return errorResponse(corsHeaders, 500, 'Internal server error', error.message);
  }
});
