import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken } from '../_shared/security.ts';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const client_id = url.searchParams.get('client_id');
    const redirect_uri = url.searchParams.get('redirect_uri');
    const response_type = url.searchParams.get('response_type');
    const scope = url.searchParams.get('scope') || '';
    const state = url.searchParams.get('state');
    const consent_id = url.searchParams.get('consent_id');
    const code_challenge = url.searchParams.get('code_challenge');
    const code_challenge_method = url.searchParams.get('code_challenge_method');

    if (!client_id || !redirect_uri || !response_type) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require PKCE for security
    if (!code_challenge || !code_challenge_method) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', error_description: 'PKCE required: code_challenge and code_challenge_method are mandatory' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (code_challenge_method !== 'S256') {
      return new Response(
        JSON.stringify({ error: 'invalid_request', error_description: 'Only S256 code_challenge_method is supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify client
    const { data: client, error: clientError } = await supabase
      .from('api_clients')
      .select('*')
      .eq('client_id', client_id)
      .eq('is_active', true)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strict redirect URI validation
    const redirectUris = client.redirect_uris as string[];
    let validRedirectUri = false;
    
    try {
      const providedUrl = new URL(redirect_uri);
      
      // Check for exact match first
      if (redirectUris.includes(redirect_uri)) {
        // Additional security checks
        
        // Enforce HTTPS in production
        const isProduction = Deno.env.get('ENVIRONMENT') === 'production';
        if (isProduction && providedUrl.protocol !== 'https:') {
          throw new Error('HTTPS required in production');
        }
        
        // Check for path traversal
        if (providedUrl.pathname.includes('..')) {
          throw new Error('Path traversal not allowed');
        }
        
        // Check for suspicious patterns
        if (providedUrl.username || providedUrl.password) {
          throw new Error('Credentials in URI not allowed');
        }
        
        validRedirectUri = true;
      }
    } catch (error) {
      console.error('Redirect URI validation error:', error);
      validRedirectUri = false;
    }
    
    if (!validRedirectUri) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', error_description: 'Invalid redirect URI' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate server-side CSRF token
    const csrfToken = generateSecureToken();

    // Store authorization session with CSRF token and PKCE challenge
    const sessionId = generateSecureToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await supabase
      .from('oauth_sessions')
      .insert({
        session_id: sessionId,
        client_id,
        redirect_uri,
        scope,
        state,
        consent_id,
        code_challenge,
        code_challenge_method,
        csrf_token: csrfToken,
        expires_at: expiresAt.toISOString(),
      });

    // Return HTML page with CSRF protection and form submission
    const authPage = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Request</title>
  <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 30px; }
    h1 { color: #333; }
    .scope { background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 4px; }
    .buttons { margin-top: 20px; }
    button { padding: 12px 24px; margin-right: 10px; border: none; border-radius: 4px; cursor: pointer; }
    .approve { background: #4CAF50; color: white; }
    .deny { background: #f44336; color: white; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorization Request</h1>
    <p><strong>${client.client_name}</strong> is requesting access to your account.</p>
    <div class="scope">
      <strong>Requested Permissions:</strong>
      <ul>
        ${scope.split(' ').map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>
    <form id="authForm" method="POST" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/consent-authorize">
      <input type="hidden" name="session_id" value="${sessionId}">
      <input type="hidden" name="csrf_token" value="${csrfToken}">
      <input type="hidden" name="action" id="actionInput">
      <div class="buttons">
        <button type="submit" class="approve" onclick="setAction('approve')">Authorize</button>
        <button type="submit" class="deny" onclick="setAction('deny')">Deny</button>
      </div>
    </form>
  </div>
  <script>
    function setAction(action) {
      document.getElementById('actionInput').value = action;
    }
  </script>
</body>
</html>
    `;

    return new Response(authPage, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'X-Frame-Options': 'DENY'
      }
    });

  } catch (error) {
    console.error('Error in oauth-authorize:', error);
    console.error('[SECURE] OAuth authorize error:', error instanceof Error ? error.message : String(error));
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new Response(
      JSON.stringify({ error: 'server_error', error_description: 'Unable to process authorization request. Please contact support.', error_id: errorId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
