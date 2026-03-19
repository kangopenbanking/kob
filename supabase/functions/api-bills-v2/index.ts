import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || '';

    // Helper: authenticate user
    const getUser = async () => {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) return null;
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      return user;
    };

    // Helper: check admin role
    const requireAdmin = async () => {
      const user = await getUser();
      if (!user) throw { status: 401, message: 'Unauthorized' };
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) throw { status: 403, message: 'Forbidden: admin role required' };
      return user;
    };

    // ─── PUBLIC DIRECTORY (no auth required) ───
    if (action === 'get_categories') {
      const { data, error } = await supabase
        .from('bill_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return json(data);
    }

    if (action === 'get_providers') {
      const categoryId = body.category_id || url.searchParams.get('category_id');
      const q = body.q || url.searchParams.get('q');
      let query = supabase
        .from('bill_providers')
        .select('*, bill_categories(name, slug, icon), bill_provider_locations(count)')
        .eq('is_active', true);
      if (categoryId) query = query.eq('category_id', categoryId);
      if (q) query = query.ilike('name', `%${q}%`);
      query = query.order('name');
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    }

    if (action === 'get_provider') {
      const providerId = body.provider_id || url.searchParams.get('provider_id');
      if (!providerId) return errorResp('provider_id required', 400);
      const { data, error } = await supabase
        .from('bill_providers')
        .select('*, bill_categories(name, slug, icon)')
        .eq('id', providerId)
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === 'get_locations') {
      const providerId = body.provider_id || url.searchParams.get('provider_id');
      if (!providerId) return errorResp('provider_id required', 400);
      const { data, error } = await supabase
        .from('bill_provider_locations')
        .select('*')
        .eq('provider_id', providerId)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return json(data);
    }

    if (action === 'get_products') {
      const providerId = body.provider_id || url.searchParams.get('provider_id');
      if (!providerId) return errorResp('provider_id required', 400);
      const locationId = body.location_id || url.searchParams.get('location_id');
      let query = supabase
        .from('bill_products')
        .select('*, bill_product_fields(*)')
        .eq('provider_id', providerId)
        .eq('is_active', true);
      if (locationId) query = query.or(`location_id.eq.${locationId},location_id.is.null`);
      query = query.order('sort_order');
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    }

    if (action === 'get_product') {
      const productId = body.product_id || url.searchParams.get('product_id');
      if (!productId) return errorResp('product_id required', 400);
      const { data, error } = await supabase
        .from('bill_products')
        .select('*, bill_product_fields(*), bill_providers(name, short_name, icon)')
        .eq('id', productId)
        .single();
      if (error) throw error;
      return json(data);
    }

    // ─── ADMIN ACTIONS ───
    if (action === 'admin_list_categories') {
      await requireAdmin();
      const { data, error } = await supabase.from('bill_categories').select('*').order('sort_order');
      if (error) throw error;
      return json(data);
    }

    if (action === 'admin_upsert_category') {
      await requireAdmin();
      const { id, name, slug, icon, color, description, is_active, sort_order } = body;
      const payload: any = { name, slug, icon, color, description, is_active: is_active ?? true, sort_order: sort_order ?? 0, updated_at: new Date().toISOString() };
      let result;
      if (id) {
        const { data, error } = await supabase.from('bill_categories').update(payload).eq('id', id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from('bill_categories').insert(payload).select().single();
        if (error) throw error;
        result = data;
      }
      return json(result);
    }

    if (action === 'admin_delete_category') {
      await requireAdmin();
      const { id } = body;
      if (!id) return errorResp('id required', 400);
      const { error } = await supabase.from('bill_categories').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'admin_list_providers') {
      await requireAdmin();
      const { category_id, status, limit: lim, offset: off } = body;
      let query = supabase.from('bill_providers').select('*, bill_categories(name, slug), bill_provider_locations(count)', { count: 'exact' });
      if (category_id) query = query.eq('category_id', category_id);
      if (status === 'active') query = query.eq('is_active', true);
      if (status === 'inactive') query = query.eq('is_active', false);
      const limit = Math.min(lim || 50, 100);
      const offset = off || 0;
      query = query.order('name').range(offset, offset + limit - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return json({ data, pagination: { total: count, limit, offset } });
    }

    if (action === 'admin_upsert_provider') {
      await requireAdmin();
      const { id, ...fields } = body;
      delete fields.action;
      fields.updated_at = new Date().toISOString();
      let result;
      if (id) {
        const { data, error } = await supabase.from('bill_providers').update(fields).eq('id', id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from('bill_providers').insert(fields).select().single();
        if (error) throw error;
        result = data;
      }
      return json(result);
    }

    if (action === 'admin_toggle_provider') {
      await requireAdmin();
      const { id, is_active } = body;
      if (!id) return errorResp('id required', 400);
      const { data, error } = await supabase.from('bill_providers').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return json(data);
    }

    if (action === 'admin_list_locations') {
      await requireAdmin();
      const { provider_id } = body;
      if (!provider_id) return errorResp('provider_id required', 400);
      const { data, error } = await supabase.from('bill_provider_locations').select('*').eq('provider_id', provider_id).order('sort_order');
      if (error) throw error;
      return json(data);
    }

    if (action === 'admin_upsert_location') {
      await requireAdmin();
      const { id, ...fields } = body;
      delete fields.action;
      fields.updated_at = new Date().toISOString();
      let result;
      if (id) {
        const { data, error } = await supabase.from('bill_provider_locations').update(fields).eq('id', id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from('bill_provider_locations').insert(fields).select().single();
        if (error) throw error;
        result = data;
      }
      return json(result);
    }

    if (action === 'admin_delete_location') {
      await requireAdmin();
      const { id } = body;
      if (!id) return errorResp('id required', 400);
      const { error } = await supabase.from('bill_provider_locations').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'admin_list_products') {
      await requireAdmin();
      const { provider_id } = body;
      if (!provider_id) return errorResp('provider_id required', 400);
      const { data, error } = await supabase.from('bill_products').select('*, bill_product_fields(*)').eq('provider_id', provider_id).order('sort_order');
      if (error) throw error;
      return json(data);
    }

    if (action === 'admin_upsert_product') {
      await requireAdmin();
      const { id, ...fields } = body;
      delete fields.action;
      fields.updated_at = new Date().toISOString();
      let result;
      if (id) {
        const { data, error } = await supabase.from('bill_products').update(fields).eq('id', id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from('bill_products').insert(fields).select().single();
        if (error) throw error;
        result = data;
      }
      return json(result);
    }

    if (action === 'admin_toggle_product') {
      await requireAdmin();
      const { id, is_active } = body;
      if (!id) return errorResp('id required', 400);
      const { data, error } = await supabase.from('bill_products').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return json(data);
    }

    if (action === 'admin_upsert_product_field') {
      await requireAdmin();
      const { id, ...fields } = body;
      delete fields.action;
      let result;
      if (id) {
        const { data, error } = await supabase.from('bill_product_fields').update(fields).eq('id', id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.from('bill_product_fields').insert(fields).select().single();
        if (error) throw error;
        result = data;
      }
      return json(result);
    }

    if (action === 'admin_delete_product_field') {
      await requireAdmin();
      const { id } = body;
      if (!id) return errorResp('id required', 400);
      const { error } = await supabase.from('bill_product_fields').delete().eq('id', id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'admin_list_payments') {
      await requireAdmin();
      const { status, provider_id, limit: lim, offset: off, from, to } = body;
      let query = supabase.from('bill_payments')
        .select('*, bill_providers(name, short_name), bill_products(name), bill_provider_locations(name, city)', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (provider_id) query = query.eq('provider_id', provider_id);
      if (from) query = query.gte('paid_at', from);
      if (to) query = query.lte('paid_at', to);
      const limit = Math.min(lim || 50, 100);
      const offset = off || 0;
      query = query.order('paid_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return json({ data, pagination: { total: count, limit, offset } });
    }

    if (action === 'admin_get_payment') {
      await requireAdmin();
      const { payment_id } = body;
      if (!payment_id) return errorResp('payment_id required', 400);
      const { data, error } = await supabase.from('bill_payments')
        .select('*, bill_providers(name, short_name, icon), bill_products(name, description), bill_provider_locations(name, city, address)')
        .eq('id', payment_id)
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === 'admin_list_settlements') {
      await requireAdmin();
      const { status, provider_id, limit: lim, offset: off } = body;
      let query = supabase.from('bill_settlements').select('*, bill_providers(name, short_name)', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (provider_id) query = query.eq('provider_id', provider_id);
      const limit = Math.min(lim || 50, 100);
      const offset = off || 0;
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data, error, count } = await query;
      if (error) throw error;
      return json({ data, pagination: { total: count, limit, offset } });
    }

    if (action === 'admin_bill_stats') {
      await requireAdmin();
      const [categories, providers, payments, intents] = await Promise.all([
        supabase.from('bill_categories').select('id', { count: 'exact', head: true }),
        supabase.from('bill_providers').select('id', { count: 'exact', head: true }),
        supabase.from('bill_payments').select('id, total_amount', { count: 'exact' }),
        supabase.from('bill_payment_intents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      const totalVolume = (payments.data || []).reduce((sum: number, p: any) => sum + Number(p.total_amount || 0), 0);
      return json({
        categories: categories.count || 0,
        providers: providers.count || 0,
        total_payments: payments.count || 0,
        pending_intents: intents.count || 0,
        total_volume: totalVolume,
      });
    }

    // ─── AUTHENTICATED CONSUMER ACTIONS ───
    const user = await getUser();
    if (!user) return errorResp('Unauthorized', 401);

    if (action === 'create_intent') {
      const { provider_id, location_id, product_id, amount, payer_details, idempotency_key } = body;
      if (!provider_id || !product_id || !payer_details) {
        return errorResp('Missing required fields: provider_id, product_id, payer_details', 400);
      }

      // Check idempotency
      if (idempotency_key) {
        const { data: existing } = await supabase
          .from('bill_payment_intents')
          .select('*')
          .eq('idempotency_key', idempotency_key)
          .single();
        if (existing) return json(existing);
      }

      // Get product to validate
      const { data: product, error: prodErr } = await supabase
        .from('bill_products')
        .select('*, bill_product_fields(*)')
        .eq('id', product_id)
        .eq('is_active', true)
        .single();
      if (prodErr || !product) return errorResp('Product not found or inactive', 404);

      // Determine amount
      let finalAmount: number;
      if (product.amount_type === 'fixed') {
        finalAmount = product.fixed_amount;
      } else {
        if (!amount || amount <= 0) return errorResp('Amount required for variable products', 400);
        if (product.min_amount && amount < product.min_amount) return errorResp(`Minimum amount is ${product.min_amount} XAF`, 400);
        if (product.max_amount && amount > product.max_amount) return errorResp(`Maximum amount is ${product.max_amount} XAF`, 400);
        finalAmount = amount;
      }

      // Validate required fields
      const requiredFields = (product.bill_product_fields || []).filter((f: any) => f.is_required);
      for (const field of requiredFields) {
        if (!payer_details[field.field_key] || String(payer_details[field.field_key]).trim() === '') {
          return errorResp(`${field.label} is required`, 400);
        }
        if (field.validation_regex) {
          const regex = new RegExp(field.validation_regex);
          if (!regex.test(String(payer_details[field.field_key]))) {
            return errorResp(`${field.label} format is invalid`, 400);
          }
        }
      }

      const feeAmount = 0;
      const totalAmount = finalAmount + feeAmount;

      const { data: intent, error: intentErr } = await supabase
        .from('bill_payment_intents')
        .insert({
          user_id: user.id,
          provider_id,
          location_id: location_id || null,
          product_id,
          amount: finalAmount,
          currency: product.currency || 'XAF',
          fee_amount: feeAmount,
          total_amount: totalAmount,
          payer_details,
          idempotency_key: idempotency_key || null,
          status: 'pending',
        })
        .select()
        .single();
      if (intentErr) throw intentErr;
      return json(intent);
    }

    if (action === 'pay_intent') {
      const { intent_id } = body;
      if (!intent_id) return errorResp('intent_id required', 400);

      const { data: intent, error: intErr } = await supabase
        .from('bill_payment_intents')
        .select('*')
        .eq('id', intent_id)
        .eq('user_id', user.id)
        .single();
      if (intErr || !intent) return errorResp('Intent not found', 404);
      if (intent.status === 'paid') return errorResp('Already paid', 409);
      if (intent.status === 'expired' || new Date(intent.expires_at) < new Date()) {
        await supabase.from('bill_payment_intents').update({ status: 'expired' }).eq('id', intent_id);
        return errorResp('Intent expired', 410);
      }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, institution_id')
        .eq('user_id', user.id)
        .limit(1);
      const primaryAccount = accounts?.[0];
      if (!primaryAccount) return errorResp('No wallet account found', 400);

      const { data: balance } = await supabase
        .from('account_balances')
        .select('id, amount')
        .eq('account_id', primaryAccount.id)
        .order('balance_datetime', { ascending: false })
        .limit(1)
        .single();

      const available = balance ? Number(balance.amount) : 0;
      if (available < intent.total_amount) {
        return errorResp('Insufficient balance', 400, {
          code: 'insufficient_balance',
          required: intent.total_amount,
          available,
        });
      }

      if (balance) {
        const { data: debitResult } = await supabase.rpc('atomic_consumer_withdrawal_debit', {
          _balance_id: balance.id,
          _debit_amount: intent.total_amount,
        });
        if (debitResult && !debitResult.success) {
          return errorResp(debitResult.error || 'Debit failed', 400);
        }
      }

      const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const traceId = `TRC-${crypto.randomUUID().slice(0, 12)}`;

      const { data: txn } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: primaryAccount.id,
          institution_id: primaryAccount.institution_id || '00000000-0000-0000-0000-000000000000',
          transaction_type: 'bill_payment',
          amount: intent.total_amount,
          currency: intent.currency,
          status: 'Booked',
          credit_debit_indicator: 'Debit',
          transaction_information: `Bill payment - ${receiptNumber}`,
          booking_datetime: new Date().toISOString(),
          value_datetime: new Date().toISOString(),
          metadata: {
            bill_payment_intent_id: intent.id,
            receipt_number: receiptNumber,
            trace_id: traceId,
            payer_details: intent.payer_details,
          },
        })
        .select('id')
        .single();

      await supabase.from('bill_payment_intents')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', intent_id);

      const { data: payment, error: payErr } = await supabase
        .from('bill_payments')
        .insert({
          intent_id: intent.id,
          user_id: user.id,
          provider_id: intent.provider_id,
          location_id: intent.location_id,
          product_id: intent.product_id,
          amount: intent.amount,
          fee_amount: intent.fee_amount,
          total_amount: intent.total_amount,
          currency: intent.currency,
          payer_details: intent.payer_details,
          receipt_number: receiptNumber,
          trace_id: traceId,
          transaction_id: txn?.id || null,
          status: 'completed',
        })
        .select()
        .single();
      if (payErr) throw payErr;

      await supabase.from('app_notifications').insert({
        user_id: user.id,
        type: 'success',
        title: 'Bill Payment Successful',
        message: `${intent.currency} ${Number(intent.total_amount).toLocaleString()} bill payment completed. Receipt: ${receiptNumber}`,
        icon: 'receipt',
        metadata: { payment_id: payment.id, receipt_number: receiptNumber },
      }).then(() => {}).catch(() => {});

      return json({
        ...payment,
        receipt_number: receiptNumber,
        trace_id: traceId,
      });
    }

    if (action === 'get_payment') {
      const paymentId = body.payment_id || url.searchParams.get('payment_id');
      if (!paymentId) return errorResp('payment_id required', 400);
      const { data, error } = await supabase
        .from('bill_payments')
        .select('*, bill_providers(name, short_name, icon), bill_products(name, description), bill_provider_locations(name, city)')
        .eq('id', paymentId)
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === 'get_payments') {
      const limit = body.limit || 20;
      const offset = body.offset || 0;
      const status = body.status;
      let query = supabase
        .from('bill_payments')
        .select('*, bill_providers(name, short_name, icon), bill_products(name)')
        .eq('user_id', user.id);
      if (status) query = query.eq('status', status);
      query = query.order('paid_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    }

    return errorResp('Unknown action', 400);
  } catch (error: any) {
    if (error.status && error.message) {
      return errorResp(error.message, error.status);
    }
    console.error('Bills v2 error:', error);
    const errorId = `ERR-${Date.now()}`;
    return new Response(JSON.stringify({ error: error.message, error_id: errorId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResp(message: string, status: number, extra?: Record<string, any>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
