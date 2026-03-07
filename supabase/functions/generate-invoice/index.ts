import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) throw new Error('Unauthorized');
    
    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const { institution_id, billing_cycle, period_start, period_end } = await req.json();
    
    if (!institution_id || !billing_cycle || !period_start || !period_end) {
      throw new Error('Missing required fields: institution_id, billing_cycle, period_start, period_end');
    }

    console.log('Generating invoice:', { institution_id, billing_cycle, period_start, period_end });

    // Pre-check: verify there are pending transaction fees for this period
    const { count: pendingCount, error: countError } = await supabase
      .from('transaction_fees')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution_id)
      .eq('billing_status', 'pending')
      .gte('transaction_date', period_start)
      .lte('transaction_date', period_end);

    if (countError) {
      console.error('Error checking pending fees:', countError);
    }

    if (!pendingCount || pendingCount === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No pending transaction fees found for this institution and period. Invoices can only be generated when there are billable fees.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 422
        }
      );
    }

    console.log(`Found ${pendingCount} pending fees for invoicing`);

    // Generate invoice using database function
    const { data: invoiceId, error: invoiceError } = await supabase.rpc('generate_institution_invoice', {
      _institution_id: institution_id,
      _billing_cycle: billing_cycle,
      _period_start: period_start,
      _period_end: period_end,
      _admin_id: user.id
    });

    if (invoiceError) {
      console.error('Invoice generation error:', invoiceError);
      throw new Error(`Failed to generate invoice: ${invoiceError.message}`);
    }

    // Fetch generated invoice with institution details
    const { data: invoice, error: fetchError } = await supabase
      .from('institution_invoices')
      .select(`
        *,
        institutions(institution_name, email, phone)
      `)
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      throw new Error('Failed to fetch generated invoice');
    }

    console.log('Invoice generated successfully:', invoice.invoice_number);

    // Trigger email notification (async, non-blocking)
    supabase.functions.invoke('send-invoice-email', {
      body: { invoice_id: invoiceId }
    }).catch(err => console.error('Email notification error:', err));

    return new Response(
      JSON.stringify({
        success: true,
        invoice
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    );
  } catch (error) {
    console.error('Generate invoice error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
