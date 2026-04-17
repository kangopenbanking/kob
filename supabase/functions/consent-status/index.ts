// Wave 5.1 — consent-status
// Unified polling endpoint that returns the current state of any consent
// (AISP, PISP, CBPII) plus its expiration window and recent events.
// Additive only — no existing endpoint changed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
  if (userError || !user) return json({ error: 'invalid_token' }, 401);

  let consent_id: string | null = null;
  let consent_type: string | null = null;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    consent_id = url.searchParams.get('consent_id');
    consent_type = url.searchParams.get('consent_type');
  } else {
    const body = await req.json().catch(() => ({}));
    consent_id = body.consent_id ?? null;
    consent_type = body.consent_type ?? null;
  }

  if (!consent_id || !consent_type || !['aisp', 'pisp', 'cbpii'].includes(consent_type)) {
    return json({ error: 'invalid_request', error_description: 'consent_id and consent_type (aisp|pisp|cbpii) required' }, 400);
  }

  const table =
    consent_type === 'aisp' ? 'aisp_consents'
    : consent_type === 'pisp' ? 'pisp_consents'
    : 'cbpii_consents';

  const { data: consent, error } = await supabase
    .from(table)
    .select('*')
    .eq('consent_id', consent_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return json({ error: 'lookup_failed', detail: error.message }, 500);
  if (!consent) return json({ error: 'consent_not_found' }, 404);

  const expiresAt = (consent as Record<string, unknown>).expiration_date ?? (consent as Record<string, unknown>).expires_at;
  const expired = expiresAt ? new Date(expiresAt as string) < new Date() : false;

  // Recent events (best-effort; table may be empty)
  const { data: events } = await supabase
    .from('consent_events')
    .select('event_type, created_at, metadata')
    .eq('consent_id', consent_id)
    .order('created_at', { ascending: false })
    .limit(10);

  return json({
    consent_id,
    consent_type,
    status: (consent as Record<string, unknown>).status,
    expires_at: expiresAt,
    expired,
    permissions: (consent as Record<string, unknown>).permissions ?? null,
    authorized_at: (consent as Record<string, unknown>).authorized_at ?? null,
    revoked_at: (consent as Record<string, unknown>).revoked_at ?? null,
    recent_events: events ?? [],
  });
});
