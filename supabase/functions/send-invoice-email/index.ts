import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Escape any value interpolated into the email HTML to prevent
// HTML/script injection in the rendered message (mailbox-side XSS / phishing).
function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip CR/LF from values that flow into email headers (to / from / subject)
// to defeat SMTP header-injection style abuse.
function sanitizeHeader(value: string): string {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

// Basic RFC-5322-ish address shape check before handing to Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Auth gate: must be a signed-in admin -------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id, _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // -----------------------------------------------------------------------

    const { invoice_id } = await req.json();
    if (!invoice_id || typeof invoice_id !== 'string') {
      return new Response(JSON.stringify({ error: 'invoice_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Sending invoice email for:', invoice_id, 'by admin:', user.id);

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
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipient = String(invoice.institutions.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(recipient)) {
      return new Response(JSON.stringify({ error: 'Institution email is invalid' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: fees, error: feesError } = await supabase
      .from('transaction_fees')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('transaction_date', { ascending: false });

    if (feesError) throw new Error('Failed to fetch fee details');

    const invoiceHtml = generateInvoiceHtml(invoice, fees || []);

    const fromAddress = sanitizeHeader(
      Deno.env.get('RESEND_FROM') || 'Kang Open Banking <noreply@notify.kangopenbanking.com>'
    );
    const subject = sanitizeHeader(`Invoice ${invoice.invoice_number} - KOB Transaction Fees`);

    const { error: emailError } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      html: invoiceHtml,
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      throw emailError;
    }

    await supabase
      .from('institution_invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', invoice_id);

    console.log(`Invoice email sent to ${recipient}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Send invoice email error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
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
          <td><strong>Invoice Number:</strong> ${esc(invoice.invoice_number)}</td>
          <td><strong>Date Issued:</strong> ${esc(new Date(invoice.created_at).toLocaleDateString())}</td>
        </tr>
        <tr>
          <td><strong>Billing Period:</strong> ${esc(new Date(invoice.period_start).toLocaleDateString())} - ${esc(new Date(invoice.period_end).toLocaleDateString())}</td>
          <td><strong>Due Date:</strong> ${esc(new Date(invoice.due_date).toLocaleDateString())}</td>
        </tr>
      </table>
    </div>

    <h3>Bill To:</h3>
    <p>
      <strong>${esc(institution.institution_name)}</strong><br>
      ${esc(institution.address || '')}<br>
      Email: ${esc(institution.email)}<br>
      Phone: ${esc(institution.phone)}
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
            <td>${esc(new Date(fee.transaction_date).toLocaleDateString())}</td>
            <td>${esc(String(fee.transaction_type).replace(/_/g, ' ').toUpperCase())}</td>
            <td>${esc(fee.transaction_ref)}</td>
            <td>${esc(Number(fee.transaction_amount).toLocaleString())} ${esc(fee.transaction_currency)}</td>
            <td>${esc(Number(fee.final_fee).toLocaleString())} ${esc(fee.transaction_currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="total">
      <p>Total Transactions: <strong>${esc(invoice.total_transactions)}</strong></p>
      <p>Subtotal: <strong>${esc(Number(invoice.subtotal_amount).toLocaleString())} ${esc(invoice.currency)}</strong></p>
      ${invoice.total_waivers > 0 ? `<p>Discounts Applied: <strong>-${esc(Number(invoice.total_waivers).toLocaleString())} ${esc(invoice.currency)}</strong></p>` : ''}
      <p style="font-size: 1.5em; color: #1e3a8a;">TOTAL DUE: <strong>${esc(Number(invoice.total_amount).toLocaleString())} ${esc(invoice.currency)}</strong></p>
    </div>

    <div class="footer">
      <p><strong>Payment Instructions:</strong></p>
      <p>Please remit payment to the account details provided in your contract.</p>
      <p>Payment Reference: ${esc(invoice.invoice_number)}</p>
      <p>For questions, contact billing@kangopenbanking.com</p>
      <p style="margin-top: 20px;">Thank you for using Kang Open Banking!</p>
    </div>
  </div>
</body>
</html>
  `;
}
