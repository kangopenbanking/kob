import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    const adminClient0 = createClient(supabaseUrl, serviceKey);

    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, adminClient0);
    if (__authResult.response) return __authResult.response;
    const user = { id: __authResult.auth!.user_id, email: __authResult.auth!.email } as any;

    const body = await req.json();
    const { action, merchant_id, operation_type, operation_id } = body;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify merchant ownership
    const { data: merchant } = await adminClient
      .from('gateway_merchants')
      .select('id')
      .eq('id', merchant_id)
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'initiate') {
      if (!operation_type || !['payouts', 'refunds', 'customers'].includes(operation_type)) {
        return new Response(JSON.stringify({ error: 'Invalid operation_type. Use: payouts, refunds, customers' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: op, error } = await adminClient
        .from('gateway_bulk_operations')
        .insert({
          merchant_id,
          type: operation_type,
          status: 'pending',
          total_records: 0,
          processed_records: 0,
          failed_records: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(op), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'status') {
      if (!operation_id) {
        return new Response(JSON.stringify({ error: 'operation_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: op, error } = await adminClient
        .from('gateway_bulk_operations')
        .select('*')
        .eq('id', operation_id)
        .eq('merchant_id', merchant_id)
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(op), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list') {
      const { data: ops, error } = await adminClient
        .from('gateway_bulk_operations')
        .select('*')
        .eq('merchant_id', merchant_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(JSON.stringify(ops || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: initiate, status, list' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-bulk-operations error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
