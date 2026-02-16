import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateUserRole, errorResponse } from "../_shared/role-middleware.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const roleResult = await validateUserRole(req, ['admin']);
    if (!roleResult.valid) {
      return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
        roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden',
        roleResult.error);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── GET: List ledger accounts ──
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const accountType = url.searchParams.get('account_type');

      let query = supabase
        .from('ledger_accounts')
        .select('*', { count: 'exact' });

      if (accountType) {
        query = query.eq('account_type', accountType);
      }

      const { data, error, count } = await query
        .order('account_code', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({
        data,
        pagination: {
          total: count || 0,
          limit,
          offset,
          has_more: (count || 0) > offset + limit,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── POST: Create ledger account ──
    if (req.method === 'POST') {
      const body = await req.json();
      const { code, name, account_type, currency, parent_id, description } = body;

      if (!code || !name || !account_type) {
        return errorResponse(corsHeaders, 400, 'validation_error', 'code, name, and account_type are required');
      }

      const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      if (!validTypes.includes(account_type)) {
        return errorResponse(corsHeaders, 400, 'validation_error', `account_type must be one of: ${validTypes.join(', ')}`);
      }

      const { data, error } = await supabase
        .from('ledger_accounts')
        .insert({
          account_code: code,
          account_name: name,
          account_type,
          currency: currency || 'XAF',
          parent_account_id: parent_id || null,
          description: description || null,
          balance: 0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return errorResponse(corsHeaders, 409, 'duplicate_account', `Account code '${code}' already exists`);
        }
        throw error;
      }

      return new Response(JSON.stringify({ data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return errorResponse(corsHeaders, 405, 'method_not_allowed', 'Use GET or POST');
  } catch (err) {
    console.error('ledger-accounts error:', err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      error_code: 'LED_999',
      message: 'An internal error occurred',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
