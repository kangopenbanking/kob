// Wave 5.1 — consent-extend
// Renews an existing AISP / PISP / CBPII consent by extending its expiration
// window. The new expiration cannot exceed 90 days from now (Open Banking
// PSD2 maximum). Re-authorization by the user is recorded as a consent_event.
// Additive only — no existing endpoint changed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_EXTENSION_DAYS = 90;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
  if (userError || !user) return json({ error: 'invalid_token' }, 401);

  const body = await req.json().catch(() => ({}));
  const { consent_id, consent_type, extend_days } = body as {
    consent_id?: string; consent_type?: string; extend_days?: number;
  };

  if (!consent_id || !consent_type || !['aisp', 'pisp', 'cbpii'].includes(consent_type)) {
    return json({ error: 'invalid_request', error_description: 'consent_id and consent_type (aisp|pisp|cbpii) required' }, 400);
  }

  const days = Math.max(1, Math.min(MAX_EXTENSION_DAYS, Number(extend_days) || 30));
  const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const table =
    consent_type === 'aisp' ? 'aisp_consents'
    : consent_type === 'pisp' ? 'pisp_consents'
    : 'cbpii_consents';

  const expiryColumn = consent_type === 'aisp' ? 'expiration_date' : 'expires_at';

  // Verify ownership and active status
  const { data: existing, error: lookupErr } = await supabase
    .from(table)
    .select('id, status, user_id')
    .eq('consent_id', consent_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupErr) return json({ error: 'lookup_failed', detail: lookupErr.message }, 500);
  if (!existing) return json({ error: 'consent_not_found' }, 404);
  if ((existing as Record<string, unknown>).status !== 'Authorised') {
    return json({ error: 'consent_not_extendable', detail: 'Only Authorised consents may be extended.' }, 409);
  }

  const { error: updErr } = await supabase
    .from(table)
    .update({ [expiryColumn]: newExpiry, updated_at: new Date().toISOString() })
    .eq('consent_id', consent_id)
    .eq('user_id', user.id);

  if (updErr) return json({ error: 'extend_failed', detail: updErr.message }, 500);

  // Record event (best-effort)
  await supabase.from('consent_events').insert({
    consent_id,
    consent_type,
    event_type: 'extended',
    user_id: user.id,
    metadata: { extend_days: days, new_expiry: newExpiry },
  });

  return json({
    consent_id,
    consent_type,
    status: 'Authorised',
    new_expiration: newExpiry,
    extended_by_days: days,
  });
});
