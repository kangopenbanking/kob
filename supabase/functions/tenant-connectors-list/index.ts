// Tenant Payment Connectors — list (no secrets returned).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );

    const url = new URL(req.url);
    const ownerType = url.searchParams.get('owner_type');
    const ownerId = url.searchParams.get('owner_id');

    let q = supabase
      .from('tenant_payment_connectors')
      .select('id, owner_type, owner_id, connector_id, environment, country, enabled, priority, display_name, health_status, last_health_check_at, last_health_error, consecutive_failures, auto_disabled_at, created_at, updated_at')
      .order('priority', { ascending: true });

    if (ownerType) q = q.eq('owner_type', ownerType);
    if (ownerId) q = q.eq('owner_id', ownerId);

    const { data, error } = await q;
    if (error) return json({ error: error.message }, 400);
    return json({ connectors: data });
  } catch (e) {
    console.error('[tenant-connectors-list]', e);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
