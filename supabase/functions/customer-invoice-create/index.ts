import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { client_name, client_email, due_date, items, notes, currency } = await req.json();

    // Validation
    if (!client_name || typeof client_name !== 'string' || client_name.trim().length < 1) {
      return new Response(JSON.stringify({ error: 'client_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!client_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
      return new Response(JSON.stringify({ error: 'valid client_email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!due_date) {
      return new Response(JSON.stringify({ error: 'due_date required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'at least one line item required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate each item
    for (const item of items) {
      if (!item.description || typeof item.description !== 'string' || item.description.trim().length < 1) {
        return new Response(JSON.stringify({ error: 'each item needs a description' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return new Response(JSON.stringify({ error: 'each item needs a positive quantity' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
        return new Response(JSON.stringify({ error: 'each item needs a positive unit price' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Calculate total server-side
    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
    if (totalAmount <= 0 || totalAmount > 1000000000) {
      return new Response(JSON.stringify({ error: 'invalid total amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate invoice number server-side
    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-6)}`;

    const sanitizedItems = items.map((item: any) => ({
      description: item.description.trim().slice(0, 500),
      quantity: Math.min(Math.max(item.quantity, 1), 99999),
      unitPrice: Math.min(Math.max(item.unitPrice, 0.01), 100000000),
    }));

    const { data: invoice, error: insertErr } = await supabase.from('customer_invoices').insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      client_name: client_name.trim().slice(0, 200),
      client_email: client_email.trim().toLowerCase().slice(0, 255),
      amount: totalAmount,
      currency: currency || 'XAF',
      status: 'pending',
      due_date,
      items: sanitizedItems,
      notes: notes ? String(notes).trim().slice(0, 1000) : null,
    }).select().single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ invoice }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('customer-invoice-create error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
