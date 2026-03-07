import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { validateUserRole, errorResponse } from "../_shared/role-middleware.ts";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return errorResponse(corsHeaders, 405, 'method_not_allowed', 'Use GET');
  }

  try {
    const roleResult = await validateUserRole(req, ['admin', 'institution']);
    if (!roleResult.valid) {
      return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
        roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden',
        roleResult.error);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    // Extract accountId from path: .../ledger-balance?account_id=xxx or URL path
    const accountId = url.searchParams.get('account_id');
    const asOfDate = url.searchParams.get('as_of');

    if (!accountId) {
      return errorResponse(corsHeaders, 400, 'validation_error', 'account_id query parameter is required');
    }

    // Get account details
    const { data: account, error: accErr } = await supabase
      .from('ledger_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accErr || !account) {
      return errorResponse(corsHeaders, 404, 'account_not_found', `Ledger account ${accountId} not found`);
    }

    // If as_of date is provided, calculate historical balance from journal lines
    if (asOfDate) {
      const { data: lines, error: linesErr } = await supabase
        .from('journal_lines')
        .select('debit, credit, journal_entry_id, journal_entries!inner(entry_date, is_reversed)')
        .eq('ledger_account_id', accountId)
        .lte('journal_entries.entry_date', asOfDate)
        .eq('journal_entries.is_reversed', false);

      if (linesErr) throw linesErr;

      let balance = 0;
      for (const line of (lines || [])) {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (['asset', 'expense'].includes(account.account_type)) {
          balance += debit - credit;
        } else {
          balance += credit - debit;
        }
      }

      return new Response(JSON.stringify({
        data: {
          ...account,
          balance,
          as_of: asOfDate,
          is_historical: true,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return current balance
    return new Response(JSON.stringify({
      data: account,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ledger-balance error:', err);
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
