import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `https://api.kangopenbanking.com/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    const url = new URL(req.url);
    const body = req.method !== 'GET' ? await req.json() : {};

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin');

    // Helper: check merchant ownership
    const checkMerchantAccess = async (merchantId: string) => {
      const { data: m } = await supabase.from('gateway_merchants').select('user_id').eq('id', merchantId).single();
      if (!m) return { error: 'Merchant not found', status: 404 };
      if (m.user_id !== user.id && !isAdmin) return { error: 'Access denied', status: 403 };
      return { error: null, status: 200 };
    };

    // ─── GET — List settlement accounts for merchant ───
    if (req.method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');
      if (!merchantId) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id required');

      const access = await checkMerchantAccess(merchantId);
      if (access.error) return rfc7807('access_error', access.error, access.status, access.error);

      const { data, error } = await supabase
        .from('gateway_merchant_settlement_accounts')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) return rfc7807('query_error', 'Query Error', 500, error.message);
      return json({ merchant_id: merchantId, accounts: data });
    }

    // ─── POST — Create settlement account ───
    if (req.method === 'POST') {
      const { action } = body;

      // Delete action
      if (action === 'delete') {
        const { account_id } = body;
        if (!account_id) return rfc7807('validation_error', 'Validation Error', 400, 'account_id required');

        const { data: acct } = await supabase
          .from('gateway_merchant_settlement_accounts').select('merchant_id, is_default').eq('id', account_id).single();
        if (!acct) return rfc7807('not_found', 'Not Found', 404, 'Settlement account not found');
        if (acct.is_default) return rfc7807('cannot_delete_default', 'Cannot Delete', 409, 'Cannot delete default settlement account');

        const access = await checkMerchantAccess(acct.merchant_id);
        if (access.error) return rfc7807('access_error', access.error, access.status, access.error);

        await supabase.from('gateway_merchant_settlement_accounts')
          .update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', account_id);

        return json({ account_id, deleted: true });
      }

      // Set default action
      if (action === 'set_default') {
        const { account_id } = body;
        if (!account_id) return rfc7807('validation_error', 'Validation Error', 400, 'account_id required');

        const { data: acct } = await supabase
          .from('gateway_merchant_settlement_accounts').select('merchant_id, currency').eq('id', account_id).single();
        if (!acct) return rfc7807('not_found', 'Not Found', 404, 'Settlement account not found');

        const access = await checkMerchantAccess(acct.merchant_id);
        if (access.error) return rfc7807('access_error', access.error, access.status, access.error);

        // Unset current default for this currency
        await supabase.from('gateway_merchant_settlement_accounts')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('merchant_id', acct.merchant_id).eq('currency', acct.currency).eq('is_default', true);

        // Set new default
        await supabase.from('gateway_merchant_settlement_accounts')
          .update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', account_id);

        return json({ account_id, is_default: true });
      }

      // Verify action (admin only)
      if (action === 'verify') {
        if (!isAdmin) return rfc7807('forbidden', 'Forbidden', 403, 'Only admins can verify settlement accounts');

        const { account_id, decision, reason } = body;
        if (!account_id) return rfc7807('validation_error', 'Validation Error', 400, 'account_id required');
        if (!['verify', 'reject'].includes(decision)) {
          return rfc7807('validation_error', 'Validation Error', 400, "decision must be 'verify' or 'reject'");
        }

        await supabase.from('gateway_merchant_settlement_accounts').update({
          verification_status: decision === 'verify' ? 'verified' : 'rejected',
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          rejection_reason: decision === 'reject' ? reason : null,
          updated_at: new Date().toISOString(),
        }).eq('id', account_id);

        await supabase.from('audit_logs').insert({
          action_type: `settlement_account_${decision === 'verify' ? 'verified' : 'rejected'}`,
          entity_type: 'settlement_account',
          entity_id: account_id,
          performed_by: user.id,
          details: { decision, reason },
        });

        return json({ account_id, verification_status: decision === 'verify' ? 'verified' : 'rejected' });
      }

      // Create new settlement account (default action)
      const { merchant_id, account_type, currency, label, bank_name, bank_code,
        account_number, account_name, swift_bic, branch_code, momo_provider,
        momo_number, paypal_email, is_default } = body;

      if (!merchant_id) return rfc7807('validation_error', 'Validation Error', 400, 'merchant_id required');
      if (!account_type) return rfc7807('validation_error', 'Validation Error', 400, 'account_type required');

      const access = await checkMerchantAccess(merchant_id);
      if (access.error) return rfc7807('access_error', access.error, access.status, access.error);

      // Validate type-specific fields
      if (account_type === 'bank_account' && (!bank_code || !account_number)) {
        return rfc7807('validation_error', 'Validation Error', 400, 'bank_code and account_number required for bank accounts');
      }
      if (account_type === 'mobile_money' && (!momo_provider || !momo_number)) {
        return rfc7807('validation_error', 'Validation Error', 400, 'momo_provider and momo_number required for mobile money');
      }
      if (account_type === 'paypal' && !paypal_email) {
        return rfc7807('validation_error', 'Validation Error', 400, 'paypal_email required for PayPal accounts');
      }

      // If setting as default, unset previous default
      if (is_default) {
        await supabase.from('gateway_merchant_settlement_accounts')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('merchant_id', merchant_id).eq('currency', currency || 'XAF').eq('is_default', true);
      }

      const { data: created, error } = await supabase.from('gateway_merchant_settlement_accounts').insert({
        merchant_id, account_type, currency: currency || 'XAF', label: label || 'Primary',
        is_default: is_default || false, bank_name, bank_code, account_number, account_name,
        swift_bic, branch_code, momo_provider, momo_number, paypal_email,
      }).select().single();

      if (error) return rfc7807('create_failed', 'Create Failed', 500, error.message);

      await supabase.from('audit_logs').insert({
        action_type: 'settlement_account_created',
        entity_type: 'settlement_account',
        entity_id: created.id,
        performed_by: user.id,
        details: { merchant_id, account_type, currency: currency || 'XAF' },
      });

      return json(created, 201);
    }

    return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only GET and POST supported');
  } catch (err: any) {
    console.error('[gateway-settlement-accounts] Error:', err);
    return rfc7807('internal_error', 'Internal Server Error', 500, err.message || 'Unexpected error');
  }
});
