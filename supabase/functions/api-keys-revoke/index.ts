// supabase/functions/api-keys-revoke
// Immediately revokes a versioned API key (cancels any grace window).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonErr(401, 'Unauthorized');
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return jsonErr(401, 'Unauthorized');

  let body: { key_id?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  if (!body.key_id) return jsonErr(400, 'key_id required');

  const { data: key } = await supabase
    .from('api_client_keys')
    .select('id, api_client_id, api_clients(developer_user_id)')
    .eq('id', body.key_id).maybeSingle();
  if (!key) return jsonErr(404, 'Key not found');

  const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roleRows ?? []).some((r: any) => r.role === 'admin');
  const ownerId = (key as any).api_clients?.developer_user_id;
  if (!isAdmin && ownerId !== user.id) return jsonErr(403, 'Forbidden');

  const { error } = await supabase
    .from('api_client_keys')
    .update({ status: 'revoked', grace_until: null, expires_at: new Date().toISOString() })
    .eq('id', body.key_id);
  if (error) return jsonErr(500, error.message);

  return new Response(JSON.stringify({ ok: true, key_id: body.key_id, status: 'revoked' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
  });
});

function jsonErr(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
