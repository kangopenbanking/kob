import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!client_id || !redirect_uri || !response_type) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters' }),
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

    // Verify redirect_uri
    const redirectUris = client.redirect_uris as string[];
    if (!redirectUris.includes(redirect_uri)) {
      return new Response(
        JSON.stringify({ error: 'invalid_request', error_description: 'Invalid redirect URI' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For this implementation, we'll return an HTML page for user authorization
    // In production, this would be a proper OAuth consent screen
    const authPage = `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Request</title>
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
    <div class="buttons">
      <button class="approve" onclick="approve()">Authorize</button>
      <button class="deny" onclick="deny()">Deny</button>
    </div>
  </div>
  <script>
    async function approve() {
      // Generate authorization code (in production, this would be done server-side)
      const code = crypto.randomUUID();
      const redirectUrl = new URL('${redirect_uri}');
      redirectUrl.searchParams.set('code', code);
      ${state ? `redirectUrl.searchParams.set('state', '${state}');` : ''}
      window.location.href = redirectUrl.toString();
    }
    
    function deny() {
      const redirectUrl = new URL('${redirect_uri}');
      redirectUrl.searchParams.set('error', 'access_denied');
      ${state ? `redirectUrl.searchParams.set('state', '${state}');` : ''}
      window.location.href = redirectUrl.toString();
    }
  </script>
</body>
</html>
    `;

    return new Response(authPage, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error in oauth-authorize:', error);
    return new Response(
      JSON.stringify({ error: 'server_error', error_description: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
