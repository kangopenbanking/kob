// supabase/functions/api-keys-list
// Lists versioned keys for an api_client (no key material returned).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const apiClientId = url.searchParams.get('api_client_id');
  if (!apiClientId) {
    return new Response(JSON.stringify({ error: 'api_client_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: client } = await supabase
    .from('api_clients').select('id, developer_user_id').eq('id', apiClientId).maybeSingle();
  const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roleRows ?? []).some((r: any) => r.role === 'admin');
  if (!client || (!isAdmin && client.developer_user_id !== user.id)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('api_client_keys')
    .select('id, key_version, key_prefix, label, status, activated_at, expires_at, grace_until, created_at')
    .eq('api_client_id', apiClientId)
    .order('key_version', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ keys: data ?? [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
  });
});
