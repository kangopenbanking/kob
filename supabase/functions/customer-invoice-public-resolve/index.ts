// Public resolver for customer invoices used by the email "Pay Now" link.
// Returns sanitized invoice details + sender's KANG ID so the recipient can
// be deep-linked into /app/transfer prefilled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { invoice_id } = await req.json();
    if (!invoice_id || typeof invoice_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing invoice_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: invoice, error } = await supabase
      .from("customer_invoices")
      .select("id, invoice_number, client_name, client_email, amount, currency, status, due_date, notes, user_id, paid_at")
      .eq("id", invoice_id)
      .maybeSingle();

    if (error || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, kang_id")
      .eq("id", invoice.user_id)
      .maybeSingle();

    return new Response(JSON.stringify({
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        due_date: invoice.due_date,
        notes: invoice.notes,
        paid_at: invoice.paid_at,
      },
      sender: {
        full_name: profile?.full_name || "Kang User",
        kang_id: profile?.kang_id || null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
