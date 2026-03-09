import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  status?: string;
  payment_method?: string;
  limit?: number;
  offset?: number;
  format?: 'json' | 'csv';
}

function generateCSV(transactions: any[]): string {
  if (transactions.length === 0) return '';

  const headers = [
    'Transaction ID',
    'Order ID',
    'Transaction Ref',
    'Payment Method',
    'Amount',
    'Currency',
    'Status',
    'Customer Email',
    'Customer Phone',
    'Created At',
    'Error Message'
  ];

  const rows = transactions.map(tx => [
    tx.id,
    tx.woocommerce_order_id,
    tx.transaction_ref,
    tx.payment_method,
    tx.amount,
    tx.currency,
    tx.status,
    tx.customer_email || '',
    tx.customer_phone || '',
    tx.created_at,
    tx.error_message || ''
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing transaction sync for user: ${user.id}`);

    // Parse query parameters
    const url = new URL(req.url);
    const filters: TransactionFilters = {
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined,
      status: url.searchParams.get('status') || undefined,
      payment_method: url.searchParams.get('payment_method') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '100'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
      format: (url.searchParams.get('format') as 'json' | 'csv') || 'json'
    };

    // Get merchant record
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('woocommerce_merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({ error: 'Merchant not found. Please register your WooCommerce store first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query
    let query = supabaseClient
      .from('woocommerce_transactions')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .range(filters.offset!, filters.offset! + filters.limit! - 1);

    // Apply filters
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.payment_method) {
      query = query.eq('payment_method', filters.payment_method);
    }

    const { data: transactions, error: txError, count } = await query;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw txError;
    }

    console.log(`Retrieved ${transactions?.length || 0} transactions`);

    // Calculate summary statistics
    const summary = {
      total_count: count || 0,
      completed_count: transactions?.filter(t => t.status === 'completed').length || 0,
      failed_count: transactions?.filter(t => t.status === 'failed').length || 0,
      pending_count: transactions?.filter(t => t.status === 'pending').length || 0,
      total_amount: transactions?.reduce((sum, t) => sum + (t.status === 'completed' ? Number(t.amount) : 0), 0) || 0
    };

    // Return CSV if requested
    if (filters.format === 'csv') {
      const csv = generateCSV(transactions || []);
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Return JSON
    return new Response(
      JSON.stringify({
        success: true,
        summary,
        transactions,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: count
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in woocommerce-transaction-sync:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
