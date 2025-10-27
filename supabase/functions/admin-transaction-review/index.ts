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

    if (method === 'POST') {
      const { action, transaction_id, notes } = await req.json();

      if (action === 'flag') {
        // Flag transaction as suspicious
        const { data, error } = await supabaseClient
          .from('transactions')
          .update({ 
            status: 'flagged',
            metadata: { flagged_by: user.id, flagged_at: new Date().toISOString(), notes }
          })
          .eq('id', transaction_id)
          .select()
          .single();

        if (error) throw error;

        // Create suspicious activity record
        await supabaseClient
          .from('suspicious_activities')
          .insert({
            user_id: data.user_id,
            activity_type: 'flagged_transaction',
            severity: 'medium',
            description: `Transaction ${transaction_id} flagged for review`,
            risk_indicators: { transaction_id, notes },
            action_taken: 'flagged',
            reviewed_by: user.id
          });

        await supabaseClient.rpc('log_audit_event', {
          _action_type: 'flag',
          _entity_type: 'transaction',
          _entity_id: transaction_id,
          _details: { notes, flagged_by: user.id }
        });

        return new Response(JSON.stringify({ transaction: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'approve') {
        // Approve transaction
        const { data, error } = await supabaseClient
          .from('transactions')
          .update({ 
            status: 'completed',
            metadata: { reviewed_by: user.id, reviewed_at: new Date().toISOString(), notes }
          })
          .eq('id', transaction_id)
          .select()
          .single();

        if (error) throw error;

        await supabaseClient.rpc('log_audit_event', {
          _action_type: 'approve',
          _entity_type: 'transaction',
          _entity_id: transaction_id,
          _details: { notes, reviewed_by: user.id }
        });

        return new Response(JSON.stringify({ transaction: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'block') {
        // Block transaction
        const { data, error } = await supabaseClient
          .from('transactions')
          .update({ 
            status: 'blocked',
            metadata: { blocked_by: user.id, blocked_at: new Date().toISOString(), notes }
          })
          .eq('id', transaction_id)
          .select()
          .single();

        if (error) throw error;

        // Create suspicious activity record
        await supabaseClient
          .from('suspicious_activities')
          .insert({
            user_id: data.user_id,
            activity_type: 'blocked_transaction',
            severity: 'high',
            description: `Transaction ${transaction_id} blocked`,
            risk_indicators: { transaction_id, notes },
            action_taken: 'blocked',
            reviewed_by: user.id
          });

        await supabaseClient.rpc('log_audit_event', {
          _action_type: 'block',
          _entity_type: 'transaction',
          _entity_id: transaction_id,
          _details: { notes, blocked_by: user.id }
        });

        return new Response(JSON.stringify({ transaction: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-transaction-review:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
