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

    // Fetch all active subscriptions with their plan details
    const { data: activeSubs, error } = await supabase
      .from("pos_store_subscriptions")
      .select("*, pos_subscription_plans(*), pos_store_profiles!inner(merchant_id, store_name)")
      .eq("status", "active");

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
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
        const storeName = sub.pos_store_profiles?.store_name || "Your store";
        const planName = sub.pos_subscription_plans?.name || "your plan";

        // Get the merchant's user_id
        const merchantId = sub.pos_store_profiles?.merchant_id;
        if (!merchantId) continue;

        const { data: merchant } = await supabase
          .from("gateway_merchants")
          .select("user_id")
          .eq("id", merchantId)
          .single();

        if (!merchant?.user_id) continue;

        // Check if we already sent a notification for this threshold today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingNotif } = await supabase
          .from("app_notifications")
          .select("id")
          .eq("user_id", merchant.user_id)
          .gte("created_at", todayStart.toISOString())
          .ilike("title", `%subscription%expir%`)
          .limit(1);

        if (existingNotif && existingNotif.length > 0) continue; // Already notified today

        let notifTitle = "";
        let notifMessage = "";
        let notifType: "warning" | "info" = "warning";
        let emailKey = "";

        if (daysLeft <= 0) {
          // Expired
          notifTitle = "Subscription Expired";
          notifMessage = `Your ${planName} subscription for "${storeName}" has expired. Renew now to keep your store visible.`;
          notifType = "warning";
          emailKey = "merchant_subscription_expired";
          results.expired++;

          // Mark as expired
          await supabase
            .from("pos_store_subscriptions")
            .update({ status: "expired" } as any)
            .eq("id", sub.id);
        } else if (daysLeft === 1) {
          notifTitle = "Subscription Expires Tomorrow!";
          notifMessage = `Your ${planName} subscription for "${storeName}" expires tomorrow. Renew now to avoid service interruption.`;
          notifType = "warning";
          emailKey = "merchant_subscription_expiring_1d";
          results.warned_1d++;
        } else if (daysLeft <= 3) {
          notifTitle = "Subscription Expiring Soon";
          notifMessage = `Your ${planName} subscription for "${storeName}" expires in ${daysLeft} days. Renew now.`;
          notifType = "warning";
          emailKey = "merchant_subscription_expiring_3d";
          results.warned_3d++;
        } else if (daysLeft <= 7) {
          notifTitle = "Subscription Renewal Reminder";
          notifMessage = `Your ${planName} subscription for "${storeName}" expires in ${daysLeft} days. Consider renewing early.`;
          notifType = "info";
          emailKey = "merchant_subscription_expiring_7d";
          results.warned_7d++;
        } else {
          continue; // Not near expiry
        }

        // Create in-app notification
        await supabase.from("app_notifications").insert({
          user_id: merchant.user_id,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          icon: "storefront",
          metadata: {
            subscription_id: sub.id,
            plan_name: planName,
            expires_at: sub.expires_at,
            days_left: daysLeft,
          },
        });

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

    console.log("Subscription expiry check complete:", results);
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
