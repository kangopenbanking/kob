import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the download request
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    // Get client IP for logging
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // WordPress plugin information
    const pluginVersion = '1.0.0';
    const pluginName = 'woo-for-kang';

    // Log the download attempt
    await supabase.from('audit_logs').insert({
      action_type: 'plugin_download_request',
      entity_type: 'woocommerce_plugin',
      entity_id: pluginVersion,
      performed_by: user?.id,
      details: {
        version: pluginVersion,
        ip_address: clientIp,
        user_agent: userAgent,
        timestamp: new Date().toISOString(),
        status: 'packaging_in_progress'
      },
      ip_address: clientIp
    });

    // Plugin is being packaged - return information
    const response = {
      success: true,
      plugin_name: pluginName,
      version: pluginVersion,
      status: 'packaging',
      message: 'The WordPress plugin files are currently being packaged. Please register your store to receive notification when the download is ready.',
      registration_url: '/integrations/woocommerce-merchant-register',
      installation_guide: '/integrations/woocommerce-docs',
      requirements: {
        php: '7.4+',
        wordpress: '5.8+',
        woocommerce: '5.0+'
      },
      expected_availability: 'Contact sales for early access'
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in woocommerce-download-plugin:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate download link',
        message: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
