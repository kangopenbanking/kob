// supabase/functions/api-keys-rotate
// Issues a new versioned API key for an api_client and starts a grace window
// during which the previous active key remains valid.
//
// POST /functions/v1/api-keys-rotate
// Body: { api_client_id: string, overlap_hours?: number (default 24, max 720), label?: string }
// Auth: Admin or the developer who owns the client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

function randHex(len: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { api_client_id?: string; overlap_hours?: number; label?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  if (!body.api_client_id) {
    return new Response(JSON.stringify({ error: 'api_client_id is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify ownership (admin or developer_user_id matches).
  const [{ data: client }, { data: roleRows }] = await Promise.all([
    supabase.from('api_clients').select('id, client_id, developer_user_id, rate_limit_tier').eq('id', body.api_client_id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);
  if (!client) {
    return new Response(JSON.stringify({ error: 'API client not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const isAdmin = (roleRows ?? []).some((r: any) => r.role === 'admin');
  if (!isAdmin && client.developer_user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const overlapHours = Math.min(Math.max(body.overlap_hours ?? 24, 0), 720);

  // Determine next version
  const { data: existing } = await supabase
    .from('api_client_keys')
    .select('key_version')
    .eq('api_client_id', client.id)
    .order('key_version', { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.key_version ?? 0) + 1;

  // Generate new key (kob_live_v{n}_<random>)
  const env = (client as any).api_environment === 'sandbox' ? 'test' : 'live';
  const rawKey = `kob_${env}_v${nextVersion}_${randHex(32)}`;
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.slice(0, 18);

  // Move currently active keys for this client into 'grace' until grace_until,
  // then will be revoked by api-keys-cleanup or by manual revoke.
  const graceUntil = overlapHours > 0 ? new Date(Date.now() + overlapHours * 3600 * 1000).toISOString() : null;
  if (graceUntil) {
    await supabase
      .from('api_client_keys')
      .update({ status: 'grace', grace_until: graceUntil })
      .eq('api_client_id', client.id)
      .eq('status', 'active');
  } else {
    await supabase
      .from('api_client_keys')
      .update({ status: 'revoked' })
      .eq('api_client_id', client.id)
      .eq('status', 'active');
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('api_client_keys')
    .insert({
      api_client_id: client.id,
      key_version: nextVersion,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: body.label ?? `Rotation ${new Date().toISOString().slice(0, 10)}`,
      status: 'active',
      activated_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select('id, key_version, status, activated_at')
    .single();

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabase.from('api_clients').update({ last_rotated_at: new Date().toISOString() }).eq('id', client.id);

  return new Response(JSON.stringify({
    api_client_id: client.id,
    client_id: client.client_id,
    api_key: rawKey,
    key_version: inserted.key_version,
    key_prefix: keyPrefix,
    activated_at: inserted.activated_at,
    overlap: { previous_keys_status: graceUntil ? 'grace' : 'revoked', grace_until: graceUntil, overlap_hours: overlapHours },
    message: 'Save this key now — it will not be shown again. Previous keys remain valid until the grace window ends.',
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
