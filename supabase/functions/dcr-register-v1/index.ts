// RFC 7591 Dynamic Client Registration — v1
// Stricter SSA/JWT validation than legacy dcr-register, with structured RFC 7591 errors.
// Additive endpoint (Guardian Standing Order 1): legacy /dcr-register remains.
//
// POST /v1/dcr/register
// Body: { software_statement, redirect_uris[], grant_types[], scope, token_endpoint_auth_method, jwks?, jwks_uri? }
// Returns 201 { client_id, client_secret, client_id_issued_at, client_secret_expires_at, registration_access_token, ... }
// Errors (RFC 7591 §3.2.2): invalid_request, invalid_redirect_uri, invalid_client_metadata,
//                          invalid_software_statement, unapproved_software_statement

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_GRANT_TYPES = new Set(['client_credentials', 'authorization_code', 'refresh_token']);
const ALLOWED_SCOPES = new Set([
  'openid', 'accounts', 'balances', 'transactions', 'payments', 'offline_access',
  'beneficiaries', 'fundsconfirmations',
]);
const ALLOWED_AUTH_METHODS = new Set([
  'tls_client_auth', 'private_key_jwt', 'client_secret_basic', 'client_secret_post',
]);

type DcrError =
  | 'invalid_request'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'invalid_software_statement'
  | 'unapproved_software_statement'
  | 'server_error';

function errorResponse(error: DcrError, description: string, status = 400) {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}

function validateRedirectUris(uris: unknown): string[] | { error: DcrError; msg: string } {
  if (!Array.isArray(uris) || uris.length === 0) {
    return { error: 'invalid_redirect_uri', msg: 'redirect_uris must be a non-empty array' };
  }
  const out: string[] = [];
  for (const raw of uris) {
    if (typeof raw !== 'string') return { error: 'invalid_redirect_uri', msg: 'redirect_uris entries must be strings' };
    let u: URL;
    try { u = new URL(raw); } catch { return { error: 'invalid_redirect_uri', msg: `not a valid URL: ${raw}` }; }
    if (u.protocol !== 'https:' && u.hostname !== 'localhost') {
      return { error: 'invalid_redirect_uri', msg: `redirect_uri must use https (or localhost): ${raw}` };
    }
    if (u.hash) return { error: 'invalid_redirect_uri', msg: `redirect_uri must not contain a fragment: ${raw}` };
    out.push(raw);
  }
  return out;
}

async function verifySsa(ssa: string, supabase: ReturnType<typeof createClient>): Promise<
  | { ok: true; payload: jose.JWTPayload }
  | { ok: false; error: DcrError; msg: string }
> {
  let header: jose.ProtectedHeaderParameters;
  let payload: jose.JWTPayload;
  try {
    header = jose.decodeProtectedHeader(ssa);
    payload = jose.decodeJwt(ssa);
  } catch (e) {
    return { ok: false, error: 'invalid_software_statement', msg: 'SSA is not a parseable JWT' };
  }

  if (!header.alg || !['RS256', 'ES256', 'PS256'].includes(header.alg)) {
    return { ok: false, error: 'invalid_software_statement', msg: `unsupported SSA alg: ${header.alg}` };
  }

  // Standard claims
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    return { ok: false, error: 'invalid_software_statement', msg: 'SSA expired' };
  }
  if (typeof payload.iat === 'number' && payload.iat > now + 60) {
    return { ok: false, error: 'invalid_software_statement', msg: 'SSA iat in the future' };
  }
  if (!payload.iss || typeof payload.iss !== 'string') {
    return { ok: false, error: 'invalid_software_statement', msg: 'SSA missing iss' };
  }
  if (!payload.software_id || !payload.software_client_name) {
    return { ok: false, error: 'invalid_software_statement', msg: 'SSA missing software_id or software_client_name' };
  }

  // Signature verification — look up approved issuer JWKS URI in system_config
  try {
    const { data: cfg } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', `dcr_ssa_issuer:${payload.iss}`)
      .maybeSingle();

    const jwksUri = (cfg?.value as { jwks_uri?: string } | undefined)?.jwks_uri;
    if (!jwksUri) {
      // No registered issuer — in sandbox, accept without sig check; in prod reject.
      const env = Deno.env.get('KOB_ENVIRONMENT') ?? 'sandbox';
      if (env === 'production') {
        return { ok: false, error: 'unapproved_software_statement', msg: `SSA issuer not approved: ${payload.iss}` };
      }
      // Sandbox path: accept decoded payload without sig verification.
      return { ok: true, payload };
    }
    const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));
    const { payload: verified } = await jose.jwtVerify(ssa, JWKS, { issuer: payload.iss });
    return { ok: true, payload: verified };
  } catch (e) {
    return { ok: false, error: 'invalid_software_statement', msg: `SSA signature verification failed: ${(e as Error).message}` };
  }
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  event: string,
  details: Record<string, unknown>,
) {
  try {
    await supabase.from('audit_logs').insert({
      event_type: event,
      resource_type: 'tpp_registration',
      details,
    });
  } catch { /* never fail the request because of audit */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return errorResponse('invalid_request', 'Method not allowed', 405);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_request', 'Request body must be valid JSON');
  }

  const {
    software_statement,
    redirect_uris,
    grant_types = ['authorization_code', 'refresh_token'],
    response_types = ['code'],
    scope = 'accounts payments',
    token_endpoint_auth_method = 'tls_client_auth',
    jwks,
    jwks_uri,
  } = body as Record<string, unknown>;

  if (typeof software_statement !== 'string' || !software_statement) {
    await audit(supabase, 'dcr_register_failed', { reason: 'missing_ssa' });
    return errorResponse('invalid_request', 'Missing software_statement');
  }

  const redirectCheck = validateRedirectUris(redirect_uris);
  if (!Array.isArray(redirectCheck)) {
    await audit(supabase, 'dcr_register_failed', { reason: 'invalid_redirect_uri', msg: redirectCheck.msg });
    return errorResponse(redirectCheck.error, redirectCheck.msg);
  }

  if (!Array.isArray(grant_types) || (grant_types as unknown[]).some((g) => typeof g !== 'string' || !ALLOWED_GRANT_TYPES.has(g))) {
    await audit(supabase, 'dcr_register_failed', { reason: 'invalid_grant_types', grant_types });
    return errorResponse('invalid_client_metadata', `grant_types must be a subset of ${[...ALLOWED_GRANT_TYPES].join(', ')}`);
  }

  if (typeof scope !== 'string') {
    return errorResponse('invalid_client_metadata', 'scope must be a space-delimited string');
  }
  const scopeList = scope.split(/\s+/).filter(Boolean);
  const badScope = scopeList.find((s) => !ALLOWED_SCOPES.has(s));
  if (badScope) {
    await audit(supabase, 'dcr_register_failed', { reason: 'invalid_scope', scope: badScope });
    return errorResponse('invalid_client_metadata', `Unsupported scope: ${badScope}`);
  }

  if (typeof token_endpoint_auth_method !== 'string' || !ALLOWED_AUTH_METHODS.has(token_endpoint_auth_method)) {
    return errorResponse('invalid_client_metadata', `Unsupported token_endpoint_auth_method: ${token_endpoint_auth_method}`);
  }

  const ssaCheck = await verifySsa(software_statement, supabase);
  if (!ssaCheck.ok) {
    await audit(supabase, 'dcr_register_failed', { reason: ssaCheck.error, msg: ssaCheck.msg });
    return errorResponse(ssaCheck.error, ssaCheck.msg);
  }
  const ssaPayload = ssaCheck.payload;

  // SSA redirect_uris (if present) must contain every requested redirect_uri.
  const ssaUris = (ssaPayload as { software_redirect_uris?: string[] }).software_redirect_uris;
  if (Array.isArray(ssaUris) && ssaUris.length > 0) {
    const allowed = new Set(ssaUris);
    const bad = redirectCheck.find((u) => !allowed.has(u));
    if (bad) {
      await audit(supabase, 'dcr_register_failed', { reason: 'ssa_uri_mismatch', uri: bad });
      return errorResponse('invalid_redirect_uri', `redirect_uri not in SSA's software_redirect_uris: ${bad}`);
    }
  }

  // Issue credentials.
  const clientId = `tpp_${crypto.randomUUID()}`;
  const clientSecret = generateSecureToken();
  const clientSecretHash = await hashSecret(clientSecret);
  const registrationAccessToken = generateSecureToken();
  const ratHash = await hashSecret(registrationAccessToken);

  const { data: institution } = await supabase
    .from('institutions')
    .select('id')
    .eq('registration_number', ssaPayload.software_id as string)
    .maybeSingle();

  const { data: registration, error: regError } = await supabase
    .from('tpp_registrations')
    .insert({
      client_id: clientId,
      client_secret_hash: clientSecretHash,
      institution_id: institution?.id ?? null,
      client_name: ssaPayload.software_client_name as string,
      software_id: ssaPayload.software_id as string,
      software_statement,
      software_roles: (ssaPayload.software_roles as string[]) ?? [],
      redirect_uris: redirectCheck,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      jwks_uri: jwks_uri ?? (ssaPayload.software_jwks_endpoint as string) ?? null,
      jwks: jwks ?? null,
      scope,
      environment: Deno.env.get('KOB_ENVIRONMENT') ?? 'sandbox',
    })
    .select()
    .single();

  if (regError) {
    console.error('dcr-register-v1 insert failed', regError);
    await audit(supabase, 'dcr_register_failed', { reason: 'persist_error', msg: regError.message });
    return errorResponse('server_error', 'Failed to register client', 500);
  }

  await audit(supabase, 'dcr_register_succeeded', {
    client_id: clientId,
    software_id: registration.software_id,
    institution_id: registration.institution_id,
  });

  // Emit registration.pending webhook (best effort).
  try {
    await supabase.from('event_outbox').insert({
      event_type: 'registration.pending',
      payload: {
        id: `evt_${crypto.randomUUID()}`,
        type: 'registration.pending',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: registration.id,
            account_type: 'developer',
            entity_id: clientId,
            status: 'pending',
            occurred_at: new Date().toISOString(),
          },
        },
      },
    });
  } catch (e) {
    console.warn('event_outbox insert failed (non-fatal)', (e as Error).message);
  }

  return new Response(
    JSON.stringify({
      client_id: registration.client_id,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(new Date(registration.created_at).getTime() / 1000),
      client_secret_expires_at: 0,
      registration_access_token: registrationAccessToken,
      registration_client_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/dcr-register-v1/${registration.client_id}`,
      client_name: registration.client_name,
      software_id: registration.software_id,
      software_roles: registration.software_roles,
      redirect_uris: registration.redirect_uris,
      grant_types: registration.grant_types,
      response_types: registration.response_types,
      token_endpoint_auth_method: registration.token_endpoint_auth_method,
      jwks_uri: registration.jwks_uri,
      scope: registration.scope,
      environment: registration.environment,
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
});

// Make hash helper available for tests (no-op in prod use).
export { errorResponse, validateRedirectUris };
