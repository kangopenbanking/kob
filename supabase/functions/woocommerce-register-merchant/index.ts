import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterMerchantRequest {
  store_name: string;
  store_url: string;
  admin_email: string;
  plugin_version?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user using the JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing merchant registration for user: ${user.id}`);

    // Parse request body
    const body: RegisterMerchantRequest = await req.json();
    const { store_name, store_url, admin_email, plugin_version } = body;

    // Validate required fields
    if (!store_name || !store_url || !admin_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: store_name, store_url, admin_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    try {
      new URL(store_url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid store URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate API credentials
    const apiKey = `wfk_live_${crypto.randomUUID().replace(/-/g, '')}`;
    const clientSecret = `wfk_secret_${crypto.randomUUID().replace(/-/g, '')}`;
    const webhookSecret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;

    // Hash the secrets for storage
    const encoder = new TextEncoder();
    const apiKeyHash = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
    const secretHash = await crypto.subtle.digest('SHA-256', encoder.encode(clientSecret));
    
    const apiKeyHashHex = Array.from(new Uint8Array(apiKeyHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const secretHashHex = Array.from(new Uint8Array(secretHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Construct webhook URL
    const webhookUrl = `${store_url.replace(/\/$/, '')}/wc-api/woo-for-kang`;

    // Insert merchant record
    const { data: merchant, error: insertError } = await supabaseClient
      .from('woocommerce_merchants')
      .insert({
        user_id: user.id,
        store_name,
        store_url,
        admin_email,
        api_key_hash: apiKeyHashHex,
        client_secret_hash: secretHashHex,
        plugin_version: plugin_version || '1.0.0',
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      
      // Check for duplicate store URL
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Store URL already registered' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw insertError;
    }

    console.log(`Merchant registered successfully: ${merchant.id}`);

    // Send welcome email (asynchronous, don't wait)
    supabaseClient.functions.invoke('send-communication', {
      body: {
        recipient_email: admin_email,
        subject: 'Welcome to Woo for Kang - API Credentials',
        body: `
Hello ${store_name} team,

Welcome to Woo for Kang! Your WooCommerce store has been successfully registered with Kang Open Banking.

Here are your API credentials (keep them secure):

API Key: ${apiKey}
Client Secret: ${clientSecret}
Webhook Secret: ${webhookSecret}

Webhook URL (auto-configured): ${webhookUrl}

Next Steps:
1. Copy your API credentials above
2. In WordPress admin, go to WooCommerce → Settings → Payments
3. Enable "Kang Open Banking" and paste your credentials
4. Configure which payment methods you want to accept
5. Test with a small transaction

Need help? Contact us at support@kangopenbanking.com

Best regards,
Kang Open Banking Team
        `,
        communication_type: 'email',
        recipient_type: 'merchant'
      }
    }).catch(err => console.error('Failed to send welcome email:', err));

    // Log audit event
    await supabaseClient.from('audit_logs').insert({
      action_type: 'woocommerce_merchant_registered',
      entity_type: 'woocommerce_merchant',
      entity_id: merchant.id,
      performed_by: user.id,
      details: {
        store_name,
        store_url,
        admin_email
      }
    });

    // Return credentials (only time they'll be shown in plain text)
    return new Response(
      JSON.stringify({
        success: true,
        merchant_id: merchant.id,
        credentials: {
          api_key: apiKey,
          client_secret: clientSecret,
          webhook_secret: webhookSecret,
          webhook_url: webhookUrl
        },
        message: 'Merchant registered successfully. Save your credentials securely - they will not be shown again.'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in woocommerce-register-merchant:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
