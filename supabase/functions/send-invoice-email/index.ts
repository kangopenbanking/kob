import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    const { invoice_id } = await req.json();
    
    if (!invoice_id) throw new Error('Missing invoice_id');

    console.log('Sending invoice email for:', invoice_id);

    // Fetch invoice with institution details
    const { data: invoice, error: invoiceError } = await supabase
      .from('institution_invoices')
      .select(`
        *,
        institutions!inner(
          institution_name,
          email,
          phone,
          address
        )
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Fetch transaction fees for this invoice
    const { data: fees, error: feesError } = await supabase
      .from('transaction_fees')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('transaction_date', { ascending: false });

    if (feesError) throw new Error('Failed to fetch fee details');

    // Generate invoice HTML
    const invoiceHtml = generateInvoiceHtml(invoice, fees || []);

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: 'Kang Open Banking <billing@kangopenbanking.com>',
      to: [invoice.institutions.email],
      subject: `Invoice ${invoice.invoice_number} - KOB Transaction Fees`,
      html: invoiceHtml,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      throw emailError;
    }

    // Update invoice status to 'sent'
    await supabase
      .from('institution_invoices')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', invoice_id);

    console.log(`Invoice email sent to ${invoice.institutions.email}`);

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Send invoice email error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

function generateInvoiceHtml(invoice: any, fees: any[]): string {
  const institution = invoice.institutions;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: #1e3a8a; color: white; padding: 30px; text-align: center; }
    .invoice-details { background: #f3f4f6; padding: 20px; margin: 20px 0; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    .table th { background: #1e3a8a; color: white; }
    .total { text-align: right; font-size: 1.2em; font-weight: bold; padding: 20px 0; }
    .footer { text-align: center; color: #666; padding: 20px; border-top: 1px solid #ddd; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>KANG OPEN BANKING</h1>
      <p>Transaction Fee Invoice</p>
    </div>
    
    <div class="invoice-details">
      <table style="width: 100%;">
        <tr>
          <td><strong>Invoice Number:</strong> ${invoice.invoice_number}</td>
          <td><strong>Date Issued:</strong> ${new Date(invoice.created_at).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td><strong>Billing Period:</strong> ${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}</td>
          <td><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</td>
        </tr>
      </table>
    </div>
    
    <h3>Bill To:</h3>
    <p>
      <strong>${institution.institution_name}</strong><br>
      ${institution.address || ''}<br>
      Email: ${institution.email}<br>
      Phone: ${institution.phone}
    </p>
    
    <h3>Transaction Fee Summary</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Transaction Type</th>
          <th>Reference</th>
          <th>Amount</th>
          <th>Fee</th>
        </tr>
      </thead>
      <tbody>
        ${fees.map(fee => `
          <tr>
            <td>${new Date(fee.transaction_date).toLocaleDateString()}</td>
            <td>${fee.transaction_type.replace(/_/g, ' ').toUpperCase()}</td>
            <td>${fee.transaction_ref}</td>
            <td>${fee.transaction_amount.toLocaleString()} ${fee.transaction_currency}</td>
            <td>${fee.final_fee.toLocaleString()} ${fee.transaction_currency}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="total">
      <p>Total Transactions: <strong>${invoice.total_transactions}</strong></p>
      <p>Subtotal: <strong>${invoice.subtotal_amount.toLocaleString()} ${invoice.currency}</strong></p>
      ${invoice.total_waivers > 0 ? `<p>Discounts Applied: <strong>-${invoice.total_waivers.toLocaleString()} ${invoice.currency}</strong></p>` : ''}
      <p style="font-size: 1.5em; color: #1e3a8a;">TOTAL DUE: <strong>${invoice.total_amount.toLocaleString()} ${invoice.currency}</strong></p>
    </div>
    
    <div class="footer">
      <p><strong>Payment Instructions:</strong></p>
      <p>Please remit payment to the account details provided in your contract.</p>
      <p>Payment Reference: ${invoice.invoice_number}</p>
      <p>For questions, contact billing@kangopenbanking.com</p>
      <p style="margin-top: 20px;">Thank you for using Kang Open Banking!</p>
    </div>
  </div>
</body>
</html>
  `;
}
