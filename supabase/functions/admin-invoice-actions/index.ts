import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { invoice_id, action, metadata } = await req.json();
    if (!invoice_id || !action) {
      return new Response(JSON.stringify({ error: 'invoice_id and action are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!['mark_paid', 'send_reminder', 'void'].includes(action)) {
      return new Response(JSON.stringify({ error: 'invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get invoice
    const { data: invoice, error: fetchErr } = await supabase
      .from('institution_invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (fetchErr || !invoice) {
      return new Response(JSON.stringify({ error: 'invoice_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'mark_paid') {
      await supabase.from('institution_invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      }).eq('id', invoice_id);
    } else if (action === 'void') {
      await supabase.from('institution_invoices').update({
        status: 'voided',
      }).eq('id', invoice_id);
    } else if (action === 'send_reminder') {
      // Trigger send-invoice-email function
      await supabase.functions.invoke('send-invoice-email', {
        body: { invoice_id, reminder: true },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: `invoice_${action}`,
      entity_type: 'institution_invoice',
      entity_id: invoice_id,
      performed_by: user.id,
      details: { action, invoice_number: invoice.invoice_number, amount: invoice.total_amount, metadata },
    });

    return new Response(JSON.stringify({ success: true, action, invoice_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
