// DDN — Shared notification helper for merchant + driver events.
// Inserts into app_notifications with idempotency_key so re-runs are safe.
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
    }, { onConflict: "idempotency_key", ignoreDuplicates: true });
  } catch (e) {
    console.error("notifyUser failed", e);
  }
}

// Resolve the owner user_id of a merchant for delivery notifications.
export async function getMerchantOwnerId(sb: SB, merchant_id: string): Promise<string | null> {
  const { data } = await sb
    .from("gateway_merchants").select("user_id").eq("id", merchant_id).maybeSingle();
  return (data as any)?.user_id ?? null;
}
