// Tenant Payment Connectors — health check using stored credentials.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decryptCredentials, getConnector } from '../_shared/payment-connectors/registry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    const { id } = await req.json();
    if (!id || typeof id !== 'string') return json({ error: 'id required' }, 400);

    // Confirm caller owns the row via RLS (user-scoped client)
    const { data: row, error } = await userClient
      .from('tenant_payment_connectors')
      .select('id, connector_id, environment, country, credentials_encrypted')
      .eq('id', id)
      .single();
    if (error || !row) return json({ error: 'not_found_or_forbidden' }, 404);

    const credentials = await decryptCredentials(row.credentials_encrypted as Record<string, unknown>);
    const connector = getConnector(row.connector_id);
    const result = await connector.healthCheck({
      credentials, environment: row.environment, country: row.country,
    });

    const newStatus = result.healthy ? 'healthy' : 'unhealthy';
    await adminClient
      .from('tenant_payment_connectors')
      .update({
        health_status: newStatus,
        last_health_check_at: new Date().toISOString(),
        last_health_error: result.error || null,
        consecutive_failures: result.healthy ? 0 : undefined,
      })
      .eq('id', id);

    return json({ result });
  } catch (e) {
    console.error('[tenant-connectors-test]', e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
