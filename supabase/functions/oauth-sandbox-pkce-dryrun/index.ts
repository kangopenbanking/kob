// Non-interactive PKCE helper for CI / sandbox automation only.
//
// Purpose: a CI smoke test cannot drive a browser through /v1/oauth/authorize
// and the consent screen. This endpoint mints an authorization_code directly
// for a sandbox OAuth client so CI can prove the *token exchange* half of the
// authorization_code + PKCE flow (RFC 7636 §4) works end-to-end against the
// live deployment.
//
// Guard rails (defense in depth):
//   1. Caller MUST send header `x-sandbox: true`.
//   2. The client_id MUST start with `sbx_` (sandbox-tier convention).
//   3. The redirect_uri MUST exactly match a redirect URI registered on the
//      sandbox client row.
//   4. The code_challenge MUST be supplied (S256 only) and is persisted as-is
//      so /v1/oauth/token can verify it against the verifier.
//   5. Codes expire in 5 minutes and are single-use (enforced by oauth-token).
//
// This function does NOT exchange the code, does NOT issue tokens, and does
// NOT bypass PKCE — it only fast-paths the user-consent step for sandbox
// clients. Production clients (no `sbx_` prefix) are rejected with 403.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken } from '../_shared/security.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (req.headers.get('x-sandbox') !== 'true') {
    return json({ error: 'forbidden', error_description: 'x-sandbox: true header required' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_request', error_description: 'JSON body required' }, 400);
  }

  const client_id = str(body.client_id);
  const redirect_uri = str(body.redirect_uri);
  const code_challenge = str(body.code_challenge);
  const code_challenge_method = str(body.code_challenge_method) || 'S256';
  const scope = str(body.scope) || 'health:read';
  const state = str(body.state) || null;

  if (!client_id || !redirect_uri || !code_challenge) {
    return json(
      { error: 'invalid_request', error_description: 'client_id, redirect_uri, code_challenge required' },
      400,
    );
  }
  if (!client_id.startsWith('sbx_')) {
    return json(
      { error: 'forbidden', error_description: 'Only sandbox clients (sbx_*) are allowed' },
      403,
    );
  }
  if (code_challenge_method !== 'S256') {
    return json(
      { error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' },
      400,
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: client, error: clientErr } = await supabase
    .from('oauth_clients')
    .select('client_id, redirect_uris')
    .eq('client_id', client_id)
    .maybeSingle();

  if (clientErr || !client) {
    return json({ error: 'invalid_client', error_description: 'Unknown sandbox client' }, 404);
  }

  const allowed: string[] = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
  if (!allowed.includes(redirect_uri)) {
    return json(
      { error: 'invalid_request', error_description: 'redirect_uri not registered for this client' },
      400,
    );
  }

  const code = generateSecureToken();
  const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase.from('authorization_codes').insert({
    code,
    client_id,
    redirect_uri,
    scope,
    code_challenge,
    code_challenge_method,
    expires_at,
    used: false,
  });

  if (insertErr) {
    console.error('[oauth-sandbox-pkce-dryrun] insert failed', insertErr);
    return json({ error: 'server_error', error_description: 'Could not mint code' }, 500);
  }

  return json({ code, state, expires_at, redirect_uri }, 200);
});

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
