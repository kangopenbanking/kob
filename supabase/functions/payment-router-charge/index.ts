// Payment Router Charge — opt-in entry point that resolves a tenant's BYO
// connectors (priority order) and falls back to platform Flutterwave on failure.
// Existing `mobile-money-charge` is NOT modified; this is purely additive.

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
  connector: z.enum(['mtn_momo', 'orange_money', 'flutterwave']).optional(),
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

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'invalid_request', details: parsed.error.flatten() }, 400);
    const body = parsed.data;

    // Resolve candidate connectors
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

    const attempts: Array<{ connector_id: string; success: boolean; error?: string }> = [];

    // Try tenant connectors in priority order
    for (const cand of (candidates || []) as CandidateRow[]) {
      try {
        const credentials = await decryptCredentials(cand.credentials_encrypted);
        const connector = getConnector(cand.connector_id);
        const result = await connector.initiateCharge(
          { credentials, environment: cand.environment, country: cand.country },
          payload,
        );
        attempts.push({ connector_id: cand.connector_id, success: result.success, error: result.error });
        if (result.success) {
          return json({
            success: true,
            connector_used: cand.connector_id,
            tenant_connector_id: cand.id,
            provider_reference: result.provider_reference,
            status: result.status,
            attempts,
          });
        }
      } catch (e) {
        attempts.push({
          connector_id: cand.connector_id, success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Fallback: explicit platform Flutterwave (if caller didn't pin a connector)
    if (!body.connector) {
      const fwSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
      if (fwSecret) {
        const connector = getConnector('flutterwave');
        const result = await connector.initiateCharge(
          { credentials: { secret_key: fwSecret }, environment: 'live', country: body.country },
          payload,
        );
        attempts.push({ connector_id: 'flutterwave_platform', success: result.success, error: result.error });
        if (result.success) {
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
