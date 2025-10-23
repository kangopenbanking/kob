import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const isEndOfMonth = today.getDate() === new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const isEndOfQuarter = [2, 5, 8, 11].includes(today.getMonth()) && isEndOfMonth;

    console.log('Running automated billing check:', { 
      today: today.toISOString(), 
      isEndOfMonth, 
      isEndOfQuarter 
    });

    // Get all approved institutions
    const { data: institutions } = await supabase
      .from('institutions')
      .select('id, institution_name')
      .eq('status', 'approved');

    if (!institutions || institutions.length === 0) {
      console.log('No institutions to process');
      return new Response(JSON.stringify({ message: 'No institutions' }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const institution of institutions) {
      // Check for monthly billing
      if (isEndOfMonth) {
        try {
          const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

          // Check if invoice already exists
          const { data: existing } = await supabase
            .from('institution_invoices')
            .select('id')
            .eq('institution_id', institution.id)
            .eq('period_start', periodStart.toISOString().split('T')[0])
            .eq('period_end', periodEnd.toISOString().split('T')[0])
            .single();

          if (existing) {
            console.log(`Monthly invoice already exists for ${institution.institution_name}`);
            continue;
          }

          // Generate monthly invoice
          const { data: invoiceId, error } = await supabase.rpc('generate_institution_invoice', {
            _institution_id: institution.id,
            _billing_cycle: 'monthly',
            _period_start: periodStart.toISOString().split('T')[0],
            _period_end: periodEnd.toISOString().split('T')[0],
            _admin_id: null
          });

          if (error) {
            console.error(`Failed to generate monthly invoice for ${institution.institution_name}:`, error);
            results.push({ 
              institution: institution.institution_name, 
              cycle: 'monthly',
              status: 'error', 
              error: error.message 
            });
          } else {
            console.log(`Generated monthly invoice for ${institution.institution_name}: ${invoiceId}`);
            
            // Send email
            await supabase.functions.invoke('send-invoice-email', {
              body: { invoice_id: invoiceId }
            });
            
            results.push({ 
              institution: institution.institution_name, 
              cycle: 'monthly',
              status: 'success', 
              invoice_id: invoiceId 
            });
          }
        } catch (err) {
          console.error(`Error processing monthly for ${institution.institution_name}:`, err);
          results.push({ 
            institution: institution.institution_name, 
            cycle: 'monthly',
            status: 'error', 
            error: String(err) 
          });
        }
      }

      // Check for quarterly billing
      if (isEndOfQuarter) {
        try {
          const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
          const periodStart = new Date(today.getFullYear(), quarterStartMonth, 1);
          const periodEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0);

          // Check if invoice already exists
          const { data: existing } = await supabase
            .from('institution_invoices')
            .select('id')
            .eq('institution_id', institution.id)
            .eq('period_start', periodStart.toISOString().split('T')[0])
            .eq('period_end', periodEnd.toISOString().split('T')[0])
            .single();

          if (existing) {
            console.log(`Quarterly invoice already exists for ${institution.institution_name}`);
            continue;
          }

          // Generate quarterly invoice
          const { data: invoiceId, error } = await supabase.rpc('generate_institution_invoice', {
            _institution_id: institution.id,
            _billing_cycle: 'quarterly',
            _period_start: periodStart.toISOString().split('T')[0],
            _period_end: periodEnd.toISOString().split('T')[0],
            _admin_id: null
          });

          if (error) {
            console.error(`Failed to generate quarterly invoice for ${institution.institution_name}:`, error);
            results.push({ 
              institution: institution.institution_name, 
              cycle: 'quarterly',
              status: 'error', 
              error: error.message 
            });
          } else {
            console.log(`Generated quarterly invoice for ${institution.institution_name}: ${invoiceId}`);
            
            // Send email
            await supabase.functions.invoke('send-invoice-email', {
              body: { invoice_id: invoiceId }
            });
            
            results.push({ 
              institution: institution.institution_name, 
              cycle: 'quarterly',
              status: 'success', 
              invoice_id: invoiceId 
            });
          }
        } catch (err) {
          console.error(`Error processing quarterly for ${institution.institution_name}:`, err);
          results.push({ 
            institution: institution.institution_name, 
            cycle: 'quarterly',
            status: 'error', 
            error: String(err) 
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Automated billing cron error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
