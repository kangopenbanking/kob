import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = body.action;

    // Actions that don't need user auth
    if (action === 'validate-api-key') return await handleValidateApiKey(req, body, supabase, supabaseUrl, serviceKey);
    if (action === 'trigger-webhook') return await handleTriggerWebhook(body, supabase);

    // Auth-required actions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errResp(401, 'Missing authorization');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return errResp(401, 'Unauthorized');

    switch (action) {
      case 'create-account': return await handleCreateAccount(body, user, supabase);
      case 'create-api-key': return await handleCreateApiKey(body, user, supabase);
      case 'generate-data': return await handleGenerateData(body, user, supabase);
      case 'register-webhook': return await handleRegisterWebhook(body, user, supabase);
      case 'test-webhook': return await handleTestWebhook(body, user, supabase);
      default: return errResp(400, `Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error('sandbox error:', error);
    return errResp(500, error.message || 'Internal error');
  }
});

function errResp(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCreateAccount(body: any, user: any, supabase: any) {
  const { data: existing } = await supabase.from('developer_sandbox_accounts').select('*').eq('user_id', user.id).single();
  if (existing) return errResp(400, 'Sandbox account already exists');
  const { data: account, error } = await supabase.from('developer_sandbox_accounts').insert([{ user_id: user.id, company_name: body.company_name, website: body.website, description: body.description, status: 'active', tier: 'free' }]).select().single();
  if (error) throw error;
  return new Response(JSON.stringify({ account }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function randHex(len: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleCreateApiKey(body: any, user: any, supabase: any) {
  const { data: account } = await supabase.from('developer_sandbox_accounts').select('*').eq('user_id', user.id).eq('status', 'active').single();
  if (!account) return errResp(404, 'No active sandbox account found');

  const { count } = await supabase.from('sandbox_api_keys').select('*', { count: 'exact', head: true }).eq('sandbox_account_id', account.id).eq('is_active', true);
  if (count && count >= 5) return errResp(400, 'Maximum API keys reached (5)');

  // Generate a complete credential set: secret key, publishable key, and webhook secret.
  // Merchant ID is account-scoped and already provisioned by DB trigger.
  const secretKey = 'sk_test_' + randHex(32);
  const publishableKey = 'pk_test_' + randHex(24);
  const webhookSecret = 'whsec_test_' + randHex(32);
  const sbxLegacyKey = 'sbx_' + randHex(32); // backward-compat for older integrations

  const [keyHash, webhookHash] = await Promise.all([sha256(secretKey), sha256(webhookSecret)]);

  const limits = { free: { per_minute: 60, per_day: 1000 }, basic: { per_minute: 300, per_day: 10000 }, pro: { per_minute: 1000, per_day: 100000 } };
  const tier = (limits as any)[account.tier] || limits.free;

  const { data: newKey, error } = await supabase.from('sandbox_api_keys').insert([{
    sandbox_account_id: account.id,
    key_name: body.key_name || 'Default Key',
    api_key: sbxLegacyKey,             // legacy column retains a value for back-compat
    key_hash: keyHash,                  // hash of the NEW secret_key
    publishable_key: publishableKey,
    webhook_secret_hash: webhookHash,
    webhook_secret_preview: webhookSecret.slice(0, 16) + '…',
    rate_limit_per_minute: tier.per_minute,
    rate_limit_per_day: tier.per_day,
  }]).select().single();
  if (error) throw error;

  return new Response(JSON.stringify({
    key_id: newKey.id,
    key_name: newKey.key_name,
    secret_key: secretKey,
    publishable_key: publishableKey,
    merchant_id: account.merchant_id,
    webhook_secret: webhookSecret,
    environment: 'sandbox',
    rate_limits: tier,
    message: 'Save these credentials now. The secret key and webhook secret will not be shown again. The publishable key and merchant ID can be retrieved later.',
    // Legacy fields retained so existing integrators do not break.
    api_key: secretKey,
  }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleGenerateData(body: any, user: any, supabase: any) {
  const { data_type, count = 1 } = body;
  if (!data_type || !['accounts', 'transactions', 'balances', 'all'].includes(data_type)) return errResp(400, 'Invalid data_type');

  const result = { accounts_created: 0, transactions_created: 0, balances_created: 0 };
  const currencies = ['XAF', 'USD', 'EUR'];
  const names = ['John Doe', 'Jane Smith', 'Acme Corp'];

  if (data_type === 'accounts' || data_type === 'all') {
    const accounts = Array.from({ length: count }, () => ({
      user_id: user.id, account_id: `ACC${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      account_holder_name: names[Math.floor(Math.random() * names.length)],
      account_type: 'Current' as any, account_subtype: 'Current' as any,
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      identification_scheme: 'LOCAL_BANK' as any, identification_value: `${Math.floor(100000000 + Math.random() * 900000000)}`, is_active: true,
    }));
    const { data: created } = await supabase.from('accounts').insert(accounts).select();
    result.accounts_created = created?.length || 0;

    if (data_type === 'all' && created) {
      for (const acct of created) {
        await supabase.from('account_balances').insert([{ account_id: acct.id, balance_type: 'InterimAvailable', amount: Math.floor(Math.random() * 1000000) + 10000, currency: 'XAF', credit_debit_indicator: 'Credit', balance_datetime: new Date().toISOString() }]);
        result.balances_created++;
        const txns = Array.from({ length: Math.floor(Math.random() * 6) + 5 }, () => ({
          account_id: acct.id, user_id: user.id, transaction_type: Math.random() > 0.5 ? 'credit' : 'debit',
          amount: Math.floor(Math.random() * 50000) + 1000, currency: 'XAF', status: 'completed',
          transaction_datetime: new Date(Date.now() - Math.random() * 30*24*60*60*1000).toISOString(),
        }));
        const { data: createdTxns } = await supabase.from('transactions').insert(txns).select();
        result.transactions_created += createdTxns?.length || 0;
      }
    }
  }

  if (data_type === 'transactions') {
    const { data: accounts } = await supabase.from('accounts').select('id').eq('user_id', user.id).limit(10);
    if (!accounts?.length) return errResp(400, 'No accounts found. Create accounts first.');
    const txns = Array.from({ length: count }, () => ({
      account_id: accounts[Math.floor(Math.random() * accounts.length)].id, user_id: user.id,
      transaction_type: Math.random() > 0.5 ? 'credit' : 'debit', amount: Math.floor(Math.random() * 50000) + 1000,
      currency: 'XAF', status: 'completed', transaction_datetime: new Date(Date.now() - Math.random() * 30*24*60*60*1000).toISOString(),
    }));
    const { data: created } = await supabase.from('transactions').insert(txns).select();
    result.transactions_created = created?.length || 0;
  }

  if (data_type === 'balances') {
    const { data: accounts } = await supabase.from('accounts').select('id').eq('user_id', user.id).limit(count);
    if (!accounts?.length) return errResp(400, 'No accounts found.');
    const balances = accounts.map((a: any) => ({ account_id: a.id, balance_type: 'InterimAvailable', amount: Math.floor(Math.random() * 1000000) + 10000, currency: 'XAF', credit_debit_indicator: 'Credit', balance_datetime: new Date().toISOString() }));
    const { data: created } = await supabase.from('account_balances').insert(balances).select();
    result.balances_created = created?.length || 0;
  }

  return new Response(JSON.stringify({ success: true, ...result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRegisterWebhook(body: any, user: any, supabase: any) {
  const { webhook_url, event_types } = body;
  if (!webhook_url || !event_types?.length) return errResp(400, 'webhook_url and event_types required');
  const { data: account } = await supabase.from('developer_sandbox_accounts').select('id').eq('user_id', user.id).single();
  if (!account) return errResp(404, 'Sandbox account not found');
  const { data: webhook, error } = await supabase.from('sandbox_webhooks').insert([{ sandbox_account_id: account.id, webhook_url, event_types, secret_key: crypto.randomUUID() }]).select().single();
  if (error) throw error;
  return new Response(JSON.stringify({ webhook }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleTestWebhook(body: any, user: any, supabase: any) {
  const { webhook_url, event_type, payload, secret_key } = body;
  if (!webhook_url || !event_type || !payload) return errResp(400, 'webhook_url, event_type, and payload required');

  const startTime = Date.now();
  let response, responseBody, error;
  try {
    response = await fetch(webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': secret_key || 'test-signature', 'X-Event-Type': event_type }, body: JSON.stringify(payload) });
    responseBody = await response.text().catch(() => null);
  } catch (e: any) { error = e.message; }

  return new Response(JSON.stringify({ success: !error && response?.ok, status_code: response?.status || 0, response_time_ms: Date.now() - startTime, response_body: responseBody, error }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleTriggerWebhook(body: any, supabase: any) {
  const { api_key_id, event_type, payload } = body;
  if (!api_key_id || !event_type || !payload) return errResp(400, 'Missing required fields');

  const { data: keyData } = await supabase.from('sandbox_api_keys').select('sandbox_account_id').eq('id', api_key_id).single();
  if (!keyData) return errResp(404, 'API key not found');

  const { data: webhooks } = await supabase.from('sandbox_webhooks').select('*').eq('sandbox_account_id', keyData.sandbox_account_id).eq('is_active', true).contains('event_types', [event_type]);
  if (!webhooks?.length) return new Response(JSON.stringify({ message: 'No active webhooks' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const results = await Promise.all(webhooks.map(async (wh: any) => {
    let result;
    try {
      const res = await fetch(wh.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': wh.secret_key }, body: JSON.stringify(payload) });
      result = { status: res.status, body: await res.text().catch(() => null) };
    } catch (e: any) { result = { status: 0, body: e.message }; }
    await supabase.from('sandbox_webhook_logs').insert([{ webhook_id: wh.id, event_type, payload, response_status: result.status, response_body: result.body }]);
    await supabase.from('sandbox_webhooks').update({ last_triggered_at: new Date().toISOString() }).eq('id', wh.id);
    return result;
  }));

  return new Response(JSON.stringify({ message: 'Webhooks triggered', results: results.map(r => ({ status: r.status })) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleValidateApiKey(req: Request, body: any, supabase: any, supabaseUrl: string, serviceKey: string) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey?.startsWith('sbx_')) return errResp(401, 'Invalid API key format');

  const keyHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  const keyHash = Array.from(new Uint8Array(keyHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: keyData } = await supabase.from('sandbox_api_keys').select('*, sandbox_account:developer_sandbox_accounts(*)').eq('key_hash', keyHash).eq('is_active', true).single();
  if (!keyData) return errResp(401, 'Invalid or inactive API key');
  if (keyData.sandbox_account.status !== 'active') return errResp(403, 'Sandbox account not active');

  await supabase.from('sandbox_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id);
  await supabase.from('sandbox_api_usage').insert([{ api_key_id: keyData.id, endpoint: body.endpoint || req.url, method: body.method || req.method, status_code: body.status_code || 200, response_time_ms: body.response_time_ms || 0 }]);

  return new Response(JSON.stringify({ valid: true, account: { company_name: keyData.sandbox_account.company_name, tier: keyData.sandbox_account.tier }, rate_limits: { per_minute: keyData.rate_limit_per_minute, per_day: keyData.rate_limit_per_day } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
