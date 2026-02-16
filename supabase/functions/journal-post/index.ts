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

  if (req.method !== 'POST') {
    return errorResponse(corsHeaders, 405, 'method_not_allowed', 'Use POST');
  }

  try {
    // ── Auth: admin only ──
    const roleResult = await validateUserRole(req, ['admin']);
    if (!roleResult.valid) {
      return errorResponse(corsHeaders, roleResult.error === 'Missing authorization header' ? 401 : 403,
        roleResult.error === 'Missing authorization header' ? 'unauthorized' : 'forbidden',
        roleResult.error);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Idempotency ──
    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return errorResponse(corsHeaders, 400, 'missing_idempotency_key', 'Idempotency-Key header is required for POST requests');
    }

    const bodyText = await req.text();
    const payloadHash = await hashPayload(bodyText);

    // Check existing idempotency key
    const { data: existing } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('client_id', roleResult.userId!)
      .eq('endpoint', 'journal-post')
      .maybeSingle();

    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        return new Response(JSON.stringify({
          error: 'idempotency_conflict',
          error_code: 'LED_002',
          message: 'Idempotency key already used with a different payload',
          timestamp: new Date().toISOString(),
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        });
      }
      // Replay cached response
      return new Response(JSON.stringify(existing.response_body), {
        status: existing.response_status || 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Idempotent-Replayed': 'true',
        },
      });
    }

    const body = JSON.parse(bodyText);
    const { entry_date, description, reference_type, reference_id, lines, institution_id } = body;

    // ── Validation ──
    if (!entry_date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
      return errorResponse(corsHeaders, 400, 'validation_error', 'entry_date, description, and at least 2 lines are required');
    }

    // Verify balanced entry
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      if (!line.ledger_account_id) {
        return errorResponse(corsHeaders, 400, 'validation_error', 'Each line must have a ledger_account_id');
      }
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      if (debit < 0 || credit < 0) {
        return errorResponse(corsHeaders, 400, 'validation_error', 'Debit and credit amounts must be non-negative');
      }
      if (debit > 0 && credit > 0) {
        return errorResponse(corsHeaders, 400, 'validation_error', 'A line cannot have both debit and credit');
      }
      totalDebit += debit;
      totalCredit += credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return new Response(JSON.stringify({
        error: 'unbalanced_entry',
        error_code: 'LED_001',
        message: `Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`,
        details: { total_debit: totalDebit, total_credit: totalCredit, difference: totalDebit - totalCredit },
        timestamp: new Date().toISOString(),
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify all ledger accounts exist
    const accountIds = lines.map((l: any) => l.ledger_account_id);
    const { data: accounts, error: accErr } = await supabase
      .from('ledger_accounts')
      .select('id')
      .in('id', accountIds);

    if (accErr) throw accErr;
    if (!accounts || accounts.length !== new Set(accountIds).size) {
      return errorResponse(corsHeaders, 400, 'invalid_account', 'One or more ledger_account_id values do not exist');
    }

    // ── Generate entry number ──
    const entryNumber = `JE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // ── Insert journal entry ──
    const { data: entry, error: entryErr } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date,
        description,
        reference_type: reference_type || 'manual',
        reference_id: reference_id || null,
        institution_id: institution_id || null,
        is_reversed: false,
      })
      .select()
      .single();

    if (entryErr) throw entryErr;

    // ── Insert journal lines ──
    const journalLines = lines.map((line: any) => ({
      journal_entry_id: entry.id,
      ledger_account_id: line.ledger_account_id,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    }));

    const { error: linesErr } = await supabase
      .from('journal_lines')
      .insert(journalLines);

    if (linesErr) throw linesErr;

    // ── Update ledger account balances ──
    for (const line of lines) {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      const netChange = debit - credit; // assets increase with debit, liabilities/equity/revenue increase with credit

      // Get account type to determine balance direction
      const { data: account } = await supabase
        .from('ledger_accounts')
        .select('balance, account_type')
        .eq('id', line.ledger_account_id)
        .single();

      if (account) {
        let newBalance: number;
        // For asset/expense accounts: balance increases with debits
        // For liability/equity/revenue accounts: balance increases with credits
        if (['asset', 'expense'].includes(account.account_type)) {
          newBalance = (account.balance || 0) + debit - credit;
        } else {
          newBalance = (account.balance || 0) + credit - debit;
        }

        await supabase
          .from('ledger_accounts')
          .update({ balance: newBalance })
          .eq('id', line.ledger_account_id);
      }
    }

    const responseBody = {
      data: {
        ...entry,
        lines: journalLines,
        total_debit: totalDebit,
        total_credit: totalCredit,
      },
    };

    // ── Cache idempotency ──
    await supabase.from('idempotency_keys').insert({
      idempotency_key: idempotencyKey,
      client_id: roleResult.userId!,
      endpoint: 'journal-post',
      payload_hash: payloadHash,
      response_status: 201,
      response_body: responseBody,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    });
  } catch (err) {
    console.error('journal-post error:', err);
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

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
