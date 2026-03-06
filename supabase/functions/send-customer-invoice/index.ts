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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error('Missing invoice_id');

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('customer_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !invoice) throw new Error('Invoice not found');

    // Get sender profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const senderName = profile?.full_name || user.email || 'Kang User';
    const items = (invoice.items as any[]) || [];

    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">${item.description}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">${Number(item.unitPrice).toLocaleString()} ${invoice.currency}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;font-weight:600;">${(item.quantity * item.unitPrice).toLocaleString()} ${invoice.currency}</td>
      </tr>
    `).join('');

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f8fafc;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1e3a8a;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <h1 style="color:#fff;font-size:22px;margin:0 0 4px;">INVOICE</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">${invoice.invoice_number}</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <table style="width:100%;margin-bottom:20px;"><tr>
        <td style="font-size:13px;color:#666;">From: <strong style="color:#333;">${senderName}</strong></td>
        <td style="font-size:13px;color:#666;text-align:right;">Due: <strong style="color:#333;">${new Date(invoice.due_date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</strong></td>
      </tr></table>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700;">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700;">Price</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:700;">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:12px;padding:20px;text-align:right;margin-top:16px;">
        <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 4px;">Amount Due</p>
        <p style="color:#fff;font-size:28px;font-weight:800;margin:0;">${Number(invoice.amount).toLocaleString()} ${invoice.currency}</p>
      </div>
      ${invoice.notes ? `<p style="margin-top:16px;font-size:13px;color:#666;font-style:italic;border-left:3px solid #e2e8f0;padding-left:12px;">${invoice.notes}</p>` : ''}
      <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:1px solid #f0f0f0;">
        <p style="font-size:12px;color:#999;margin:0;">Sent via <strong>Kang Open Banking</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Create app notification for the sender
    await supabase.from('app_notifications').insert({
      user_id: user.id,
      type: 'success',
      title: 'Invoice Sent',
      message: `Invoice ${invoice.invoice_number} for ${Number(invoice.amount).toLocaleString()} ${invoice.currency} sent to ${invoice.client_email}`,
      icon: 'invoice',
      metadata: { invoice_id: invoice.id, client_email: invoice.client_email, amount: invoice.amount }
    });

    // Update invoice sent_at
    await supabase
      .from('customer_invoices')
      .update({ sent_at: new Date().toISOString(), status: 'sent' })
      .eq('id', invoice_id);

    console.log(`Customer invoice ${invoice.invoice_number} processed for ${invoice.client_email}`);

    return new Response(
      JSON.stringify({ success: true, invoice_number: invoice.invoice_number, email_html_length: emailHtml.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Send customer invoice error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
