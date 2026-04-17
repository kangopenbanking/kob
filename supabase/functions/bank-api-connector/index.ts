// KOB Bank API Connector — connector_pull mode
// Polls external bank REST APIs and normalizes responses into bank_sourced_* tables
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action');

    // Auth: cron or admin
    const cronCheck = verifyCronAuth(req);
    if (!cronCheck.authorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        if (token !== supabaseServiceKey) {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (error || !user) return errorResp('Unauthorized', 401);
          const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
          if (!isAdmin) return errorResp('Admin only', 403);
        }
      } else {
        return cronCheck.response!;
      }
    }

    switch (action) {
      // ─── Register API Endpoint Config ───
      case 'register_endpoint': {
        const { bank_id, name, base_url, auth_method, auth_config, paths, environment, poll_interval_seconds } = body;
        if (!bank_id || !name || !base_url) return errorResp('bank_id, name, base_url required', 400);

        const validAuthMethods = ['api_key', 'oauth2_client_credentials', 'basic', 'bearer_token', 'mtls'];
        if (auth_method && !validAuthMethods.includes(auth_method)) {
          return errorResp(`auth_method must be one of: ${validAuthMethods.join(', ')}`, 400);
        }

        const { data, error } = await supabase.from('bank_api_endpoints').insert({
          bank_id,
          name,
          base_url,
          auth_method: auth_method || 'api_key',
          auth_config_encrypted: auth_config || {},
          paths: paths || {},
          environment: environment || 'sandbox',
          poll_interval_seconds: poll_interval_seconds || 300,
          is_active: true,
        }).select().single();

        if (error) return errorResp(error.message, 400);
        return jsonResp(data, 201);
      }

      // ─── List API Endpoints ───
      case 'list_endpoints': {
        const { bank_id } = body;
        let query = supabase.from('bank_api_endpoints').select('*, banks(display_name)');
        if (bank_id) query = query.eq('bank_id', bank_id);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) return errorResp(error.message, 400);
        return jsonResp({ endpoints: data });
      }

      // ─── Update API Endpoint ───
      case 'update_endpoint': {
        const { endpoint_id, ...updates } = body;
        if (!endpoint_id) return errorResp('endpoint_id required', 400);
        const allowed = ['name', 'base_url', 'auth_method', 'auth_config_encrypted', 'paths', 'poll_interval_seconds', 'is_active', 'environment'];
        const safe: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const k of allowed) {
          if (updates[k] !== undefined) safe[k] = updates[k];
        }
        if (updates.auth_config) safe.auth_config_encrypted = updates.auth_config;
        const { data, error } = await supabase.from('bank_api_endpoints').update(safe).eq('id', endpoint_id).select().single();
        if (error) return errorResp(error.message, 400);
        return jsonResp(data);
      }

      // ─── Test Connectivity ───
      case 'test_endpoint': {
        const { endpoint_id } = body;
        if (!endpoint_id) return errorResp('endpoint_id required', 400);
        const { data: ep } = await supabase.from('bank_api_endpoints').select('*').eq('id', endpoint_id).single();
        if (!ep) return errorResp('Endpoint not found', 404);

        const headers = await buildAuthHeaders(ep);
        const healthPath = ep.paths?.health || '/health';
        const start = Date.now();
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const resp = await fetch(`${ep.base_url}${healthPath}`, { method: 'GET', headers, signal: ctrl.signal });
          clearTimeout(t);
          const latency = Date.now() - start;
          return jsonResp({
            success: resp.ok,
            reachable: resp.ok,
            status: resp.status,
            latency_ms: latency,
            tested_at: new Date().toISOString(),
          });
        } catch (e: any) {
          return jsonResp({ success: false, reachable: false, error: e.message, tested_at: new Date().toISOString() });
        }
      }

      // ─── Trigger Manual Pull ───
      case 'trigger_pull': {
        const { endpoint_id } = body;
        if (!endpoint_id) return errorResp('endpoint_id required', 400);
        const { data: ep } = await supabase.from('bank_api_endpoints').select('*').eq('id', endpoint_id).single();
        if (!ep) return errorResp('Endpoint not found', 404);
        const result = await executePull(supabase, ep);
        return jsonResp(result);
      }

      // ─── Poll Due Endpoints (cron) ───
      case 'poll_due': {
        const now = new Date();
        const { data: endpoints } = await supabase.from('bank_api_endpoints')
          .select('*').eq('is_active', true);

        if (!endpoints?.length) return jsonResp({ polled: 0, message: 'No active endpoints' });

        const due = endpoints.filter((ep: any) => {
          if (!ep.last_poll_at) return true;
          const elapsed = (now.getTime() - new Date(ep.last_poll_at).getTime()) / 1000;
          return elapsed >= ep.poll_interval_seconds;
        });

        const results = [];
        for (const ep of due) {
          const result = await executePull(supabase, ep);
          results.push(result);
        }
        return jsonResp({ polled: results.length, results });
      }

      // ─── List Pull Runs ───
      case 'list_pull_runs': {
        const { endpoint_id, bank_id, limit = 50 } = body;
        let query = supabase.from('bank_api_pull_runs').select('*', { count: 'exact' });
        if (endpoint_id) query = query.eq('endpoint_id', endpoint_id);
        if (bank_id) query = query.eq('bank_id', bank_id);
        const { data, error, count } = await query.order('started_at', { ascending: false }).limit(limit);
        if (error) return errorResp(error.message, 400);
        return jsonResp({ runs: data, total: count });
      }

      default:
        return errorResp(`Unknown action: ${action}`, 400);
    }
  } catch (err: any) {
    console.error('[bank-api-connector] Error:', err);
    const errorId = crypto.randomUUID().slice(0, 8);
    return errorResp(`Internal error [${errorId}]`, 500);
  }
});

// ─── Pull Execution Engine ───

async function executePull(supabase: any, ep: any) {
  const errors: any[] = [];
  let accountsSynced = 0, transactionsSynced = 0, balancesSynced = 0;
  const bankId = ep.bank_id;

  // Create pull run record
  const { data: run } = await supabase.from('bank_api_pull_runs').insert({
    endpoint_id: ep.id,
    bank_id: bankId,
    status: 'running',
  }).select().single();

  try {
    const headers = await buildAuthHeaders(ep);
    const paths = ep.paths || {};
    const watermark = ep.watermark_value || '1970-01-01T00:00:00Z';

    // Pull accounts
    if (paths.accounts) {
      try {
        const url = buildUrl(ep.base_url, paths.accounts, { since: watermark });
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          const rows = data.accounts || data.data || data || [];
          if (Array.isArray(rows) && rows.length > 0) {
            const mapped = rows.map((r: any) => ({
              bank_id: bankId,
              external_account_id: r.id || r.account_id || r.external_account_id,
              account_type: r.account_type || r.type || 'CurrentAccount',
              identification_scheme: r.scheme || 'BBAN',
              identification_value: r.account_number || r.identification_value || '',
              currency: r.currency || 'XAF',
              status: r.status || 'active',
              nickname: r.nickname || r.name || null,
            }));
            const { data: upserted } = await supabase.from('bank_sourced_accounts')
              .upsert(mapped, { onConflict: 'bank_id,external_account_id' }).select();
            accountsSynced = upserted?.length || 0;
          }
        } else {
          errors.push({ type: 'accounts_pull_error', message: `HTTP ${resp.status}` });
        }
      } catch (e: any) { errors.push({ type: 'accounts_pull_error', message: e.message }); }
    }

    // Pull transactions
    if (paths.transactions) {
      try {
        const url = buildUrl(ep.base_url, paths.transactions, { since: watermark });
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          const rows = data.transactions || data.data || data || [];
          if (Array.isArray(rows) && rows.length > 0) {
            const { data: accts } = await supabase.from('bank_sourced_accounts')
              .select('id, external_account_id').eq('bank_id', bankId);
            const acctMap = new Map((accts || []).map((a: any) => [a.external_account_id, a.id]));

            const mapped = rows.map((r: any) => ({
              account_id: acctMap.get(r.account_id || r.account_ref) || r.account_id,
              external_tx_id: r.id || r.tx_id || r.external_tx_id || crypto.randomUUID(),
              booking_date: r.booking_date || r.date,
              value_date: r.value_date || r.booking_date || r.date,
              amount: r.amount,
              currency: r.currency || 'XAF',
              credit_debit: r.credit_debit || r.direction || (r.amount > 0 ? 'Credit' : 'Debit'),
              reference: r.reference || null,
              description: r.description || r.narration || null,
            })).filter((t: any) => t.account_id && t.booking_date);

            if (mapped.length > 0) {
              const { data: upserted } = await supabase.from('bank_sourced_transactions')
                .upsert(mapped, { onConflict: 'account_id,external_tx_id' }).select();
              transactionsSynced = upserted?.length || 0;
            }
          }
        } else {
          errors.push({ type: 'transactions_pull_error', message: `HTTP ${resp.status}` });
        }
      } catch (e: any) { errors.push({ type: 'transactions_pull_error', message: e.message }); }
    }

    // Pull balances
    if (paths.balances) {
      try {
        const url = buildUrl(ep.base_url, paths.balances, { since: watermark });
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          const rows = data.balances || data.data || data || [];
          if (Array.isArray(rows) && rows.length > 0) {
            const { data: accts } = await supabase.from('bank_sourced_accounts')
              .select('id, external_account_id').eq('bank_id', bankId);
            const acctMap = new Map((accts || []).map((a: any) => [a.external_account_id, a.id]));

            const mapped = rows.map((r: any) => ({
              account_id: acctMap.get(r.account_id || r.account_ref) || r.account_id,
              balance_type: r.balance_type || 'ClosingAvailable',
              amount: r.amount || r.balance,
              currency: r.currency || 'XAF',
              as_of_datetime: r.as_of || r.timestamp || new Date().toISOString(),
            })).filter((b: any) => b.account_id);

            if (mapped.length > 0) {
              const { data: inserted } = await supabase.from('bank_sourced_balances').insert(mapped).select();
              balancesSynced = inserted?.length || 0;
            }
          }
        } else {
          errors.push({ type: 'balances_pull_error', message: `HTTP ${resp.status}` });
        }
      } catch (e: any) { errors.push({ type: 'balances_pull_error', message: e.message }); }
    }
  } catch (e: any) {
    errors.push({ type: 'pull_error', message: e.message });
  }

  const status = errors.length > 0
    ? (accountsSynced + transactionsSynced + balancesSynced > 0 ? 'partial' : 'failed')
    : 'completed';

  // Update pull run
  if (run) {
    await supabase.from('bank_api_pull_runs').update({
      status,
      completed_at: new Date().toISOString(),
      accounts_synced: accountsSynced,
      transactions_synced: transactionsSynced,
      balances_synced: balancesSynced,
      errors_json: errors.length > 0 ? errors : null,
    }).eq('id', run.id);
  }

  // Update endpoint watermark
  await supabase.from('bank_api_endpoints').update({
    last_poll_at: new Date().toISOString(),
    last_poll_status: status,
    watermark_value: status !== 'failed' ? new Date().toISOString() : ep.watermark_value,
    updated_at: new Date().toISOString(),
  }).eq('id', ep.id);

  return {
    run_id: run?.id,
    endpoint_id: ep.id,
    bank_id: ep.bank_id,
    status,
    accounts_synced: accountsSynced,
    transactions_synced: transactionsSynced,
    balances_synced: balancesSynced,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ─── Auth Header Builder ───

async function buildAuthHeaders(ep: any): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const config = ep.auth_config_encrypted || {};

  switch (ep.auth_method) {
    case 'api_key':
      if (config.header_name && config.api_key) {
        headers[config.header_name] = config.api_key;
      } else if (config.api_key) {
        headers['X-API-Key'] = config.api_key;
      }
      break;

    case 'bearer_token':
      if (config.token) headers['Authorization'] = `Bearer ${config.token}`;
      break;

    case 'basic':
      if (config.username && config.password) {
        headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
      }
      break;

    case 'oauth2_client_credentials': {
      if (config.token_url && config.client_id && config.client_secret) {
        try {
          const tokenResp = await fetch(config.token_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: config.client_id,
              client_secret: config.client_secret,
              ...(config.scope ? { scope: config.scope } : {}),
            }),
          });
          if (tokenResp.ok) {
            const tokenData = await tokenResp.json();
            headers['Authorization'] = `Bearer ${tokenData.access_token}`;
          }
        } catch (e) {
          console.error('OAuth2 token exchange failed:', e);
        }
      }
      break;
    }
  }

  return headers;
}

function buildUrl(baseUrl: string, path: string, params: Record<string, string>): string {
  const url = new URL(path, baseUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResp(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
