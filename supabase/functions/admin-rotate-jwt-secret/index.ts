import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { generateSecureToken, hashSecret } from '../_shared/security.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Check if user is admin
    const { data: roleData } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate IP whitelist
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim();
    if (clientIP) {
      const { data: ipValid } = await supabase.rpc('validate_ip_whitelist', {
        _user_id: user.id,
        _client_ip: clientIP
      });

      if (!ipValid) {
        console.log('IP whitelist validation failed:', clientIP);
        return new Response(
          JSON.stringify({ error: 'Unauthorized: IP not whitelisted' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate new JWT secret
    const newSecret = generateSecureToken();
    const secretHash = await hashSecret(newSecret);

    // Get current active version number
    const { data: currentSecrets } = await supabase
      .from('jwt_secrets')
      .select('secret_version')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentVersion = currentSecrets?.[0]?.secret_version || 'v0';
    const versionNumber = parseInt(currentVersion.replace('v', '')) || 0;
    const newVersion = `v${versionNumber + 1}`;

    // Deactivate old secrets (keep for 7-day grace period)
    await supabase
      .from('jwt_secrets')
      .update({ is_active: false })
      .eq('is_active', true);

    // Insert new secret
    const { data: newSecretRecord, error: insertError } = await supabase
      .from('jwt_secrets')
      .insert({
        secret_version: newVersion,
        secret_hash: secretHash,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log the rotation
    await supabase.rpc('log_audit_event', {
      _action_type: 'jwt_secret_rotated',
      _entity_type: 'jwt_secrets',
      _entity_id: newSecretRecord.id,
      _details: {
        old_version: currentVersion,
        new_version: newVersion,
        rotated_by: user.email
      }
    });

    console.log(`JWT secret rotated from ${currentVersion} to ${newVersion}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'JWT secret rotated successfully',
        new_version: newVersion,
        expires_at: newSecretRecord.expires_at,
        grace_period_days: 7
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error rotating JWT secret:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
