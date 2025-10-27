import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const method = req.method;
    const url = new URL(req.url);
    const webhookId = url.searchParams.get('id');

    if (method === 'GET') {
      if (webhookId) {
        // Get specific webhook with delivery stats
        const { data: webhook, error: webhookError } = await supabaseClient
          .from('webhooks')
          .select('*')
          .eq('id', webhookId)
          .single();

        if (webhookError) throw webhookError;

        const { data: deliveries, error: deliveriesError } = await supabaseClient
          .from('webhook_deliveries')
          .select('*')
          .eq('webhook_id', webhookId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (deliveriesError) throw deliveriesError;

        return new Response(JSON.stringify({ webhook, deliveries }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all webhooks
      const { data: webhooks, error } = await supabaseClient
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ webhooks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST') {
      // Create webhook
      const { url: webhook_url, events, description, client_id } = await req.json();

      const { data, error } = await supabaseClient
        .from('webhooks')
        .insert({
          url: webhook_url,
          events,
          description,
          client_id,
          is_active: true,
          secret: crypto.randomUUID()
        })
        .select()
        .single();

      if (error) throw error;

      await supabaseClient.rpc('log_audit_event', {
        _action_type: 'create',
        _entity_type: 'webhook',
        _entity_id: data.id,
        _details: { url: webhook_url, events }
      });

      return new Response(JSON.stringify({ webhook: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'PUT' && webhookId) {
      // Update webhook
      const { url: webhook_url, events, description, is_active } = await req.json();

      const { data, error } = await supabaseClient
        .from('webhooks')
        .update({
          url: webhook_url,
          events,
          description,
          is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', webhookId)
        .select()
        .single();

      if (error) throw error;

      await supabaseClient.rpc('log_audit_event', {
        _action_type: 'update',
        _entity_type: 'webhook',
        _entity_id: webhookId,
        _details: { url: webhook_url, events, is_active }
      });

      return new Response(JSON.stringify({ webhook: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'DELETE' && webhookId) {
      // Delete webhook
      const { error } = await supabaseClient
        .from('webhooks')
        .delete()
        .eq('id', webhookId);

      if (error) throw error;

      await supabaseClient.rpc('log_audit_event', {
        _action_type: 'delete',
        _entity_type: 'webhook',
        _entity_id: webhookId,
        _details: {}
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-webhooks:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
