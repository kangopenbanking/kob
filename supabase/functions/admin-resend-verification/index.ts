import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list_unverified') {
      // List all unverified email users
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });

      if (error) throw error;

      const unverified = (users || [])
        .filter(u => u.email && !u.email_confirmed_at && !u.email?.includes('@temp.'))
        .map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          full_name: u.user_metadata?.full_name || null,
        }));

      return new Response(JSON.stringify({ users: unverified, count: unverified.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'resend_single') {
      const { email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use admin API to generate a new invite link which triggers email
      const { error } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email,
        options: { redirectTo: 'https://kangopenbanking.com/app/auth' },
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, email }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'resend_all') {
      // Get all unverified users
      const { data: { users }, error } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });

      if (error) throw error;

      const unverified = (users || [])
        .filter(u => u.email && !u.email_confirmed_at && !u.email?.includes('@temp.'));

      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const u of unverified) {
        try {
          const { error: resendErr } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email: u.email!,
            options: { redirectTo: 'https://kangopenbanking.com/app/auth' },
          });

          results.push({
            email: u.email!,
            success: !resendErr,
            error: resendErr?.message,
          });
        } catch (err: any) {
          results.push({
            email: u.email!,
            success: false,
            error: err.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(JSON.stringify({
        total: unverified.length,
        success: successCount,
        failed: failCount,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: list_unverified, resend_single, resend_all' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
