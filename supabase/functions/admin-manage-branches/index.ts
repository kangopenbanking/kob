import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-institution-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Insufficient permissions');
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const branchId = pathParts[pathParts.length - 1];

    if (req.method === 'GET' || (req.method === 'POST' && !pathParts[pathParts.length - 1].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
      // Handle both GET and POST for fetching branches (POST used by supabase.functions.invoke)
      let institutionId: string | undefined;
      
      if (req.method === 'POST') {
        const body = await req.json();
        institutionId = body.institution_id;
      } else {
        institutionId = url.searchParams.get('institution_id') || undefined;
      }
      
      let query = supabaseAdmin
        .from('branches')
        .select('*, institutions(institution_name)');
      
      if (institutionId) {
        query = query.eq('institution_id', institutionId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      return new Response(
        JSON.stringify({ branches: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && branchId) {
      const body = await req.json();
      
      const { data, error } = await supabaseAdmin
        .from('branches')
        .insert({
          ...body,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'create_branch',
        _entity_type: 'branch',
        _entity_id: data.id,
        _details: { branch_name: body.branch_name, institution_id: body.institution_id }
      });

      return new Response(
        JSON.stringify({ success: true, branch: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT' && branchId) {
      const body = await req.json();
      
      const { data, error } = await supabaseAdmin
        .from('branches')
        .update(body)
        .eq('id', branchId)
        .select()
        .single();

      if (error) throw error;

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'update_branch',
        _entity_type: 'branch',
        _entity_id: branchId,
        _details: body
      });

      return new Response(
        JSON.stringify({ success: true, branch: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE' && branchId) {
      const { error } = await supabaseAdmin
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;

      await supabaseAdmin.rpc('log_audit_event', {
        _action_type: 'delete_branch',
        _entity_type: 'branch',
        _entity_id: branchId,
        _details: {}
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Branch deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error managing branches:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
