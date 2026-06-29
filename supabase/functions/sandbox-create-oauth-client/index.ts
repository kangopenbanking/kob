import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';
import { corsHeaders } from "../_shared/cors.ts";
import {
  clientIpFrom,
  extractTurnstileToken,
  logTurnstileDecision,
  turnstileEnforceEnabled,
  verifyTurnstile,
} from "../_shared/turnstile.ts";
import { enforceDeveloperVelocity } from "../_shared/developer-velocity.ts";

const ALL_SCOPES = ['openid', 'accounts', 'balances', 'transactions', 'payments', 'offline_access'];
const ALL_GRANT_TYPES = ['client_credentials', 'authorization_code', 'refresh_token'];

function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeRedirectUris(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',').map(u => u.trim()).filter(Boolean);
  return arr.map(String).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      console.warn('sandbox-create-oauth-client unauthorized request', {
        reason: authError?.message || 'missing_user',
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if caller is an admin
    const { data: isAdmin, error: roleError } = await adminSupabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('sandbox-create-oauth-client role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify caller role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      client_name,
      redirect_uris,
      scopes,
      grant_types,
      institution_id,
      rate_limit_tier = 'free',
      developer_company,
      developer_use_case,
      turnstile_token,
    } = body;

    if (!client_name || typeof client_name !== 'string' || client_name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid field: client_name (min 2 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUris = normalizeRedirectUris(redirect_uris);
    for (const uri of normalizedUris) {
      if (!isValidUrl(uri)) {
        return new Response(
          JSON.stringify({ error: 'invalid_redirect_uri', error_description: `Invalid redirect URI: ${uri}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const selectedScopes = Array.isArray(scopes) && scopes.length > 0
      ? scopes.filter((s: string) => ALL_SCOPES.includes(s))
      : ALL_SCOPES;

    const selectedGrantTypes = Array.isArray(grant_types) && grant_types.length > 0
      ? grant_types.filter((g: string) => ALL_GRANT_TYPES.includes(g))
      : ALL_GRANT_TYPES;

    if (selectedScopes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'invalid_scope', error_description: 'At least one valid scope is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (selectedGrantTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'invalid_grant_type', error_description: 'At least one valid grant type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalInstitutionId: string | null = null;

    if (isAdmin) {
      // Admin can optionally create a sandbox OAuth client for an institution
      if (institution_id) {
        const { data: institution, error: instError } = await adminSupabase
          .from('institutions')
          .select('id')
          .eq('id', institution_id)
          .maybeSingle();
        if (instError || !institution) {
          return new Response(
            JSON.stringify({ error: 'invalid_institution', error_description: 'Institution not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        finalInstitutionId = institution_id;
      }
    } else {
      // Developer self-service: apply bot/velocity gates
      const velocity = await enforceDeveloperVelocity(req, 'sandbox-create-oauth-client', user.id);
      if (velocity) return velocity;

      const ts_ip = clientIpFrom(req);
      const ts_result = await verifyTurnstile(turnstile_token, ts_ip, { expectedAction: 'sandbox_create_oauth_client' });
      await logTurnstileDecision(adminSupabase, {
        endpoint: 'sandbox-create-oauth-client',
        user_id: user.id,
        ip: ts_ip,
        result: ts_result,
      });
      if (turnstileEnforceEnabled() && !ts_result.ok) {
        return new Response(
          JSON.stringify({
            error: 'turnstile_failed',
            reason: ts_result.reason,
            codes: ts_result.codes,
            retryable: true,
            message: 'Bot verification failed. Please complete the challenge again and retry.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Developers cannot set an institution_id they do not own
      if (institution_id) {
        const { data: institution, error: instError } = await adminSupabase
          .from('institutions')
          .select('id, user_id')
          .eq('id', institution_id)
          .maybeSingle();
        if (instError || !institution || institution.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'forbidden', error_description: 'You do not own this institution' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        finalInstitutionId = institution_id;
      }
    }

    // Get user profile for developer metadata
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    // Rate limits based on tier
    const rateLimits: Record<string, number> = {
      free: 1000,
      starter: 10000,
      professional: 100000,
      enterprise: 1000000
    };
    const monthly_requests_limit = rateLimits[rate_limit_tier] || 1000;

    // Generate sandbox OAuth client credentials
    const client_id = `sbx_${crypto.randomUUID()}`;
    const client_secret = generateSecureToken();
    const client_secret_hash = await hashSecret(client_secret);

    const { data: client, error } = await adminSupabase
      .from('api_clients')
      .insert({
        client_id,
        client_secret_hash,
        client_name: client_name.trim(),
        redirect_uris: normalizedUris,
        scopes: selectedScopes,
        grant_types: selectedGrantTypes,
        institution_id: finalInstitutionId,
        developer_user_id: isAdmin ? null : user.id,
        developer_email: profile?.email || user.email,
        developer_company: developer_company || null,
        developer_use_case: developer_use_case || null,
        api_environment: 'sandbox',
        rate_limit_tier: rate_limit_tier || 'free',
        monthly_requests_limit,
        requests_used: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sandbox OAuth client:', error);
      throw error;
    }

    await adminSupabase.from('audit_logs').insert({
      entity_type: 'api_client',
      entity_id: client.id,
      action_type: 'sandbox_oauth_client_created',
      performed_by: user.id,
      details: {
        client_id,
        client_name: client_name.trim(),
        api_environment: 'sandbox',
        rate_limit_tier,
        created_by_admin: isAdmin,
        institution_id: finalInstitutionId,
      }
    });

    console.log(`Sandbox OAuth client created: ${client_id} by ${user.email} (admin=${isAdmin})`);

    return new Response(
      JSON.stringify({
        success: true,
        client_id,
        client_secret,
        client_name: client_name.trim(),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        registration_client_uri: `${Deno.env.get('PUBLIC_GATEWAY_URL') || 'https://api.kangopenbanking.com'}/v1/dcr/clients/${client_id}`,
        api_environment: 'sandbox',
        rate_limit_tier,
        monthly_requests_limit,
        redirect_uris: normalizedUris,
        scopes: selectedScopes,
        grant_types: selectedGrantTypes,
        created_at: client.created_at,
        message: 'Sandbox OAuth client created successfully. Store your client_secret securely - it will not be shown again.'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sandbox-create-oauth-client:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
