// DDN — Shared notification helper for merchant + driver events.
// Inserts into app_notifications with idempotency_key so re-runs are safe.
// Also exposes a push helper that fans out via the platform push-notification
// edge function (OneSignal + Pusher fallback).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type SB = ReturnType<typeof createClient>;

export async function notifyUser(sb: SB, params: {
  user_id: string;
  type: string;             // e.g. "ddn.assignment.accepted"
  title: string;
  message: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  idempotency_key: string;  // unique per (event, assignment)
}) {
  try {
    await sb.from("app_notifications").upsert({
      user_id: params.user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      icon: params.icon ?? "truck",
      metadata: params.metadata ?? {},
      idempotency_key: params.idempotency_key,
      is_read: false,
    }, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true });
  } catch (e) {
    console.error("notifyUser failed", e);
  }
}

// Send a push (OneSignal) notification using the platform push-notification
// edge function. Caller must be running with the service-role key in env.
export async function notifyUserPush(params: {
  user_id: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/push-notification`;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRole}`,
        "apikey": serviceRole,
      },
      body: JSON.stringify({
        target_user_id: params.user_id,
        external_user_id: params.user_id,
        title: params.title,
        message: params.message,
        url: params.url,
        data: params.data ?? {},
      }),
    }).catch(() => {});
  } catch (e) {
    console.error("notifyUserPush failed", e);
  }
}

// Check rules to see if a given driver push channel is enabled.
export async function isDriverPushEnabled(sb: SB, kind: "offer" | "assignment_change" | "missed_pickup"): Promise<boolean> {
  try {
    const { data } = await sb.from("ddn_driver_notification_rules")
      .select("offer_push_enabled, assignment_change_push, missed_pickup_push")
      .eq("singleton", true).maybeSingle();
    if (!data) return true;
    if (kind === "offer") return !!(data as any).offer_push_enabled;
    if (kind === "assignment_change") return !!(data as any).assignment_change_push;
    return !!(data as any).missed_pickup_push;
  } catch { return true; }
}

// Resolve the owner user_id of a merchant for delivery notifications.
export async function getMerchantOwnerId(sb: SB, merchant_id: string): Promise<string | null> {
  const { data } = await sb
    .from("gateway_merchants").select("user_id").eq("id", merchant_id).maybeSingle();
  return (data as any)?.user_id ?? null;
}

// Resolve the user_id of the driver by driver_id (ddn_drivers.id).
export async function getDriverUserId(sb: SB, driver_id: string): Promise<string | null> {
  const { data } = await sb
    .from("ddn_drivers").select("user_id").eq("id", driver_id).maybeSingle();
  return (data as any)?.user_id ?? null;
}
