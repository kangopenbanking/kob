// Account Deletion Request — GDPR Article 17 (Right to Erasure)
// Records a deletion request from any mobile/web app surface (banking, business,
// customer, merchant). Backed by the existing public.data_privacy_requests table
// so admins can review and complete erasure within the regulatory deadline.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_SOURCES = new Set([
  "business_app",
  "customer_app",
  "banking_app",
  "merchant_dashboard",
  "consumer_pwa",
  "web",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* tolerate empty body */ }

    const source = String(body.source ?? "web").toLowerCase();
    if (!ALLOWED_SOURCES.has(source)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid source" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reason = typeof body.reason === "string"
      ? body.reason.slice(0, 500)
      : "User-initiated account deletion request";
    const merchantId = typeof body.merchant_id === "string" ? body.merchant_id : null;
    const userEmail = typeof body.user_email === "string" ? body.user_email : (user.email ?? null);

    // Idempotent: reuse a pending request for this user if one exists.
    const { data: existing } = await supabase
      .from("data_privacy_requests")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("request_type", "deletion")
      .eq("status", "pending")
      .maybeSingle();

    let requestId: string;
    if (existing?.id) {
      requestId = existing.id;
    } else {
      // GDPR Art. 12(3): respond within 30 days.
      const deadline = new Date();
      deadline.setUTCDate(deadline.getUTCDate() + 30);

      const { data: inserted, error: insertError } = await supabase
        .from("data_privacy_requests")
        .insert({
          user_id: user.id,
          request_type: "deletion",
          status: "pending",
          request_details: {
            source,
            merchant_id: merchantId,
            user_email: userEmail,
            reason,
            requested_at: new Date().toISOString(),
          },
          data_categories: ["profile", "transactions", "kyc", "communications"],
          completion_deadline: deadline.toISOString().slice(0, 10),
          notes: `Submitted from ${source}`,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[account-delete-request] insert error", insertError);
        return new Response(
          JSON.stringify({ success: false, message: "Could not record deletion request" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      requestId = inserted.id;
    }

    // Best-effort notification — never block the request on send failure.
    try {
      await supabase.functions.invoke("send-communication", {
        body: {
          channel: "email",
          template_key: "account_deletion_received",
          to: userEmail,
          variables: {
            request_id: requestId,
            source,
            sla_days: 30,
          },
        },
      });
    } catch (notifyError) {
      console.warn("[account-delete-request] notify failed (non-fatal)", notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        status: "pending",
        sla_days: 30,
        message:
          "Deletion request received. Our team will complete erasure within 30 days as required by GDPR.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[account-delete-request] unexpected error", error);
    return new Response(
      JSON.stringify({ success: false, message: "Request processing failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
