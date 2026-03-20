import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail, getUserName } from "../_shared/send-managed-email.ts";

/**
 * Cron-triggered function to send EMAIL notifications for expiring subscriptions.
 * In-app notifications are already handled by the DB function notify_subscription_expiry_warning().
 * This function adds email alerts at 7d, 3d, 1d, and expired milestones.
 * Runs daily at 8 AM.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const results = { warned_7d: 0, warned_3d: 0, warned_1d: 0, expired: 0, errors: 0 };

    // Fetch all active subscriptions with plan details
    const { data: activeSubs, error } = await supabase
      .from("pos_store_subscriptions")
      .select("*, pos_subscription_plans(*)")
      .eq("status", "active");

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions", details: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!activeSubs || activeSubs.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions to check", results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const sub of activeSubs) {
      try {
        const expiresAt = new Date(sub.expires_at);
        const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const planName = sub.pos_subscription_plans?.name || "your plan";

        if (daysLeft > 7) continue; // Not near expiry

        // Get merchant user_id
        const { data: merchant } = await supabase
          .from("gateway_merchants")
          .select("user_id")
          .eq("id", sub.merchant_id)
          .single();

        if (!merchant?.user_id) continue;

        // Get store name
        const { data: store } = await supabase
          .from("pos_store_profiles")
          .select("store_name")
          .eq("merchant_id", sub.merchant_id)
          .maybeSingle();

        const storeName = store?.store_name || "Your store";

        // Check if we already sent an email for this threshold today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingLog } = await supabase
          .from("managed_email_logs")
          .select("id")
          .eq("recipient_user_id", merchant.user_id)
          .gte("created_at", todayStart.toISOString())
          .ilike("subject", "%subscription%expir%")
          .limit(1);

        if (existingLog && existingLog.length > 0) continue;

        let emailKey = "";

        if (daysLeft <= 0) {
          emailKey = "merchant_subscription_expired";
          results.expired++;
          // Mark as expired
          await supabase
            .from("pos_store_subscriptions")
            .update({ status: "expired" } as any)
            .eq("id", sub.id);
        } else if (daysLeft === 1) {
          emailKey = "merchant_subscription_expiring_1d";
          results.warned_1d++;
        } else if (daysLeft <= 3) {
          emailKey = "merchant_subscription_expiring_3d";
          results.warned_3d++;
        } else if (daysLeft <= 7) {
          emailKey = "merchant_subscription_expiring_7d";
          results.warned_7d++;
        }

        if (!emailKey) continue;

        // Send email notification
        const customerName = await getUserName(supabase, merchant.user_id);
        sendManagedEmail(supabase, {
          email_key: emailKey,
          recipient_user_id: merchant.user_id,
          variables: {
            customer_name: customerName,
            store_name: storeName,
            plan_name: planName,
            expiry_date: expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
            days_left: String(Math.max(0, daysLeft)),
          },
        });
      } catch (subErr) {
        console.error(`Error processing subscription ${sub.id}:`, subErr);
        results.errors++;
      }
    }

    console.log("Subscription expiry email check complete:", results);
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] check-subscription-expiry error:`, err);
    return new Response(JSON.stringify({ error: "Internal error", error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
