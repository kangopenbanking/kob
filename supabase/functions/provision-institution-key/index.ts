import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_SCOPES = new Set([
  'ledger:read', 'ledger:post',
  'payments:read', 'payments:write',
  'accounts:read',
  'loans:read', 'loans:write',
  'savings:read', 'savings:write',
  'admin:reports',
]);

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

function randomToken(bytes = 32) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return toHex(b.buffer);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (roleErr || !isAdmin) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { institution_id?: string; environment?: 'test' | 'live'; scopes?: string[]; label?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const institution_id = body.institution_id?.trim();
  const environment = body.environment;
  const scopes = Array.isArray(body.scopes) ? body.scopes : [];

  if (!institution_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institution_id)) {
    return new Response(JSON.stringify({ error: 'invalid_institution_id' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (environment !== 'test' && environment !== 'live') {
    return new Response(JSON.stringify({ error: 'invalid_environment' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const invalidScopes = scopes.filter(s => !ALLOWED_SCOPES.has(s));
  if (invalidScopes.length) {
    return new Response(JSON.stringify({ error: 'invalid_scopes', invalidScopes }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: inst, error: instErr } = await admin
    .from('institutions')
    .select('id, operational_status')
    .eq('id', institution_id)
    .maybeSingle();
  if (instErr || !inst) {
    return new Response(JSON.stringify({ error: 'institution_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secretEntropy = randomToken(32);
  const secretPlain = `kob_sec_${environment}_${secretEntropy}`;
  const pubEntropy = randomToken(16);
  const publicPlain = `kob_pub_${environment}_${pubEntropy}`;

  const rowsToInsert = [
    {
      institution_id,
      environment,
      key_type: 'publishable',
      key_prefix: publicPlain.slice(0, 12),
      key_hash: await sha256Hex(publicPlain),
      scopes,
      status: 'active',
      created_by: userId,
      label: body.label ? `${body.label} (Publishable)` : 'Publishable Key',
    },
    {
      institution_id,
      environment,
      key_type: 'secret',
      key_prefix: secretPlain.slice(0, 12),
      key_hash: await sha256Hex(secretPlain),
      scopes,
      status: 'active',
      created_by: userId,
      label: body.label ? `${body.label} (Secret)` : 'Secret Key',
    }
  ];

  const { data: inserted, error: insErr } = await admin
    .from('api_credentials')
    .insert(rowsToInsert)
    .select('id, key_type, key_prefix, environment, scopes, created_at');

  if (insErr || !inserted) {
    return new Response(JSON.stringify({ error: 'insert_failed', detail: insErr?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await admin.from('institutions').update({
    provisioned_at: new Date().toISOString(),
    provisioned_by: userId,
  }).eq('id', institution_id);

  return new Response(JSON.stringify({
    institution_id,
    environment,
    scopes,
    publishable_key: publicPlain,
    secret_key: secretPlain,
    warning: 'Store these keys securely. The secret key will not be shown again.',
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
