// Payment Router Charge — opt-in entry point that resolves a tenant's BYO
// connectors (priority order, multi-rail failover) and falls back to platform
// Flutterwave on failure. Existing `mobile-money-charge` is NOT modified.
//
// Phase 2: records every attempt to byo_routing_attempts for admin debugging,
// and enqueues byo_charge_polls rows when a direct rail returns `pending` so
// the byo-charge-poller can reconcile asynchronously.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { decryptCredentials, getConnector } from '../_shared/payment-connectors/registry.ts';
import type { ChargePayload, ConnectorId } from '../_shared/payment-connectors/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const Schema = z.object({
  owner_type: z.enum(['institution', 'merchant', 'developer']),
  owner_id: z.string().uuid(),
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3),
  phone_number: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  reference: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  callback_url: z.string().url().optional(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().max(120).optional(),
  country: z.string().length(2).default('CM'),
  connector: z.enum(['mtn_momo', 'orange_money', 'flutterwave', 'soap_bank']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

interface CandidateRow {
  id: string;
  connector_id: ConnectorId;
  environment: 'sandbox' | 'live';
  country: string;
  priority: number;
  credentials_encrypted: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    const body = parsed.data;

    // Resolve candidate connectors (multi-rail: ALL enabled, priority asc)
    let query = userClient
      .from('tenant_payment_connectors')
      .select('id, connector_id, environment, country, priority, credentials_encrypted')
      .eq('owner_type', body.owner_type)
      .eq('owner_id', body.owner_id)
      .eq('enabled', true)
      .eq('country', body.country)
      .order('priority', { ascending: true });

    if (body.connector) query = query.eq('connector_id', body.connector);

    const { data: candidates, error: qErr } = await query;
    if (qErr) return json({ error: qErr.message }, 400);

    const payload: ChargePayload = {
      amount: body.amount, currency: body.currency,
      phone_number: body.phone_number, reference: body.reference,
      description: body.description, callback_url: body.callback_url,
      customer_email: body.customer_email, customer_name: body.customer_name,
      metadata: body.metadata,
    };

    const attempts: Array<{ connector_id: string; success: boolean; status?: string; error?: string }> = [];

    const recordAttempt = async (
      connectorId: string,
      tenantConnectorId: string | null,
      attemptIndex: number,
      success: boolean,
      status: string | undefined,
      providerRef: string | undefined,
      errorCode: string | undefined,
      errorMessage: string | undefined,
      durationMs: number,
    ) => {
      try {
        await adminClient.from('byo_routing_attempts').insert({
          charge_reference: body.reference,
          owner_type: body.owner_type,
          owner_id: body.owner_id,
          connector_id: connectorId,
          tenant_connector_id: tenantConnectorId,
          attempt_index: attemptIndex,
          success,
          status,
          provider_reference: providerRef,
          error_code: errorCode,
          error_message: errorMessage,
          duration_ms: durationMs,
        });
      } catch (e) {
        console.warn('[payment-router-charge] attempt log skipped', e);
      }
    };

    const enqueuePoll = async (
      tenantConnectorId: string,
      connectorId: string,
      providerRef: string,
    ) => {
      try {
        await adminClient.from('byo_charge_polls').insert({
          tenant_connector_id: tenantConnectorId,
          connector_id: connectorId,
          provider_reference: providerRef,
          owner_type: body.owner_type,
          owner_id: body.owner_id,
          status: 'pending',
          metadata: { amount: body.amount, currency: body.currency, reference: body.reference },
        });
      } catch (e) {
        console.warn('[payment-router-charge] poll enqueue skipped', e);
      }
    };

    const recordByoFee = async (
      txType: 'byo_mobile_money_routing' | 'byo_fallback_charge',
      providerRef: string | undefined,
      connectorUsed: string,
    ) => {
      if (body.owner_type !== 'institution') return;
      try {
        await userClient.rpc('record_transaction_fee', {
          _institution_id: body.owner_id,
          _transaction_type: txType,
          _transaction_ref: body.reference,
          _transaction_amount: body.amount,
          _metadata: { connector_used: connectorUsed, provider_reference: providerRef, currency: body.currency, country: body.country },
        });
      } catch (feeErr) {
        console.warn('[payment-router-charge] fee record skipped', feeErr instanceof Error ? feeErr.message : feeErr);
      }
    };

    let attemptIndex = 0;

    // Multi-rail failover: try each tenant connector in priority order
    for (const cand of (candidates || []) as CandidateRow[]) {
      attemptIndex++;
      const start = Date.now();
      try {
        const credentials = await decryptCredentials(cand.credentials_encrypted);
        const connector = getConnector(cand.connector_id);
        const result = await connector.initiateCharge(
          { credentials, environment: cand.environment, country: cand.country },
          payload,
        );
        const dur = Date.now() - start;
        attempts.push({ connector_id: cand.connector_id, success: result.success, status: result.status, error: result.error });
        await recordAttempt(cand.connector_id, cand.id, attemptIndex, result.success, result.status, result.provider_reference, result.error_code, result.error, dur);

        if (result.success) {
          await recordByoFee('byo_mobile_money_routing', result.provider_reference, cand.connector_id);

          // Enqueue async polling for direct rails returning pending
          if (result.status === 'pending' && result.provider_reference &&
              (cand.connector_id === 'mtn_momo' || cand.connector_id === 'orange_money' || cand.connector_id === 'soap_bank')) {
            await enqueuePoll(cand.id, cand.connector_id, result.provider_reference);
          }

          return json({
            success: true,
            connector_used: cand.connector_id,
            tenant_connector_id: cand.id,
            provider_reference: result.provider_reference,
            status: result.status,
            attempts,
            polling_enqueued: result.status === 'pending',
          });
        }
        // success === false → continue to next rail
      } catch (e) {
        const dur = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        attempts.push({ connector_id: cand.connector_id, success: false, error: msg });
        await recordAttempt(cand.connector_id, cand.id, attemptIndex, false, 'failed', undefined, 'connector_exception', msg, dur);
      }
    }

    // Fallback: platform Flutterwave (only when caller didn't pin a connector)
    if (!body.connector) {
      const fwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (fwSecret) {
        attemptIndex++;
        const start = Date.now();
        const connector = getConnector('flutterwave');
        const result = await connector.initiateCharge(
          { credentials: { secret_key: fwSecret }, environment: 'live', country: body.country },
          payload,
        );
        const dur = Date.now() - start;
        attempts.push({ connector_id: 'flutterwave_platform', success: result.success, status: result.status, error: result.error });
        await recordAttempt('flutterwave_platform', null, attemptIndex, result.success, result.status, result.provider_reference, result.error_code, result.error, dur);

        if (result.success) {
          await recordByoFee('byo_fallback_charge', result.provider_reference, 'flutterwave_platform');
          return json({
            success: true, connector_used: 'flutterwave_platform',
            provider_reference: result.provider_reference,
            status: result.status, attempts,
          });
        }
      }
    }

    return json({ success: false, error: 'all_connectors_failed', attempts }, 502);
  } catch (e) {
    console.error('[payment-router-charge]', e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
