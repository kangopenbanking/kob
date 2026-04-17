// bank-data-router: unified entrypoint for bank-account-level operations. — redeploy 2026-04-17 phase3b
// Resolves bank → enabled adapter (priority order) → executes op → records attempt.
// Mirrors payment-router-charge pattern. Admin-only (verified via JWT + role).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getBankConnector } from '../_shared/bank-connectors/registry.ts';
import type { BankConnectorContext, DateRange } from '../_shared/bank-connectors/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const RequestSchema = z.object({
  bank_id: z.string().uuid(),
  operation: z.enum(['get_account', 'get_balance', 'get_transactions', 'initiate_transfer', 'reconcile', 'health_check']),
  external_account_id: z.string().optional(),
  date_range: z.object({ from: z.string(), to: z.string() }).optional(),
  transfer: z.object({
    from_account: z.string(),
    to_account: z.string(),
    amount: z.number().positive(),
    currency: z.string(),
    reference: z.string(),
    description: z.string().optional(),
    beneficiary_name: z.string().optional(),
    beneficiary_bank_code: z.string().optional(),
  }).optional(),
  correlation_id: z.string().optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function recordAttempt(
  admin: ReturnType<typeof createClient>,
  configId: string,
  bankId: string,
  operation: string,
  status: 'success' | 'failed' | 'timeout',
  latencyMs: number,
  correlationId?: string,
  errorMessage?: string,
  responseMeta?: Record<string, unknown>,
) {
  await admin.from('bank_connector_attempts').insert({
    config_id: configId,
    bank_id: bankId,
    operation,
    status,
    latency_ms: latencyMs,
    correlation_id: correlationId ?? null,
    error_message: errorMessage ?? null,
    response_meta: responseMeta ?? {},
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Invalid token' }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admin role required' }, 403);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { bank_id, operation, external_account_id, date_range, transfer, correlation_id } = parsed.data;

  // Resolve enabled configs by priority
  const { data: configs, error: cfgErr } = await admin
    .from('bank_connector_configs')
    .select('*')
    .eq('bank_id', bank_id)
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (cfgErr) return json({ error: 'Config lookup failed', detail: cfgErr.message }, 500);
  if (!configs || configs.length === 0) return json({ error: 'No enabled adapters for bank' }, 404);

  const range: DateRange = date_range ?? {
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  };

  let lastError: string | undefined;

  for (const cfg of configs) {
    const start = Date.now();
    try {
      const connector = getBankConnector(cfg.adapter_type as 'rest' | 'sql' | 'file' | 'soap');
      const ctx: BankConnectorContext = {
        bank_id,
        config_id: cfg.id,
        credentials: (cfg.credentials_encrypted ?? {}) as Record<string, string>,
        config: (cfg.config_json ?? {}) as Record<string, unknown>,
        environment: cfg.environment,
        watermark: cfg.last_sync_watermark,
      };

      let result: unknown;
      switch (operation) {
        case 'get_account':
          if (!external_account_id) throw new Error('external_account_id required');
          result = await connector.getAccountDetails(ctx, external_account_id);
          break;
        case 'get_balance':
          if (!external_account_id) throw new Error('external_account_id required');
          result = await connector.getBalance(ctx, external_account_id);
          break;
        case 'get_transactions':
          if (!external_account_id) throw new Error('external_account_id required');
          result = await connector.getTransactions(ctx, external_account_id, range);
          break;
        case 'initiate_transfer':
          if (!transfer) throw new Error('transfer payload required');
          result = await connector.initiateTransfer(ctx, transfer);
          break;
        case 'reconcile':
          result = await connector.reconcile(ctx, range);
          break;
        case 'health_check':
          result = await connector.healthCheck(ctx);
          break;
      }

      const latency = Date.now() - start;
      await recordAttempt(admin, cfg.id, bank_id, operation, 'success', latency, correlation_id, undefined, { ok: true });

      // Update health
      await admin.from('bank_connector_configs').update({
        health_status: 'healthy',
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'ok',
        last_sync_error: null,
      }).eq('id', cfg.id);

      return json({
        success: true,
        adapter_type: cfg.adapter_type,
        config_id: cfg.id,
        latency_ms: latency,
        result,
      });
    } catch (e) {
      const latency = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      await recordAttempt(admin, cfg.id, bank_id, operation, 'failed', latency, correlation_id, msg);
      await admin.from('bank_connector_configs').update({
        health_status: 'degraded',
        last_sync_status: 'error',
        last_sync_error: msg.slice(0, 500),
      }).eq('id', cfg.id);
      // continue to next adapter
    }
  }

  return json({ success: false, error: 'All adapters failed', last_error: lastError }, 502);
});
