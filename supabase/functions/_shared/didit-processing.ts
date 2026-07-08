// Shared Didit webhook event processor.
// Used by:
//   - didit-webhook        (live delivery)
//   - didit-webhook-monitor (retry cron)
// Kept out of a per-function folder so both can import it — Supabase edge
// functions cannot import across function directories.

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "didit-processing", ...entry }));
}

export function mapDiditStatusToKyc(
  status: string,
): "approved" | "rejected" | "pending" | "manual_review" | null {
  switch (status) {
    case "Approved":
      return "approved";
    case "Declined":
      return "rejected";
    case "In Review":
      return "manual_review";
    case "Resubmitted":
    case "In Progress":
    case "Awaiting User":
    case "Not Started":
      return "pending";
    case "Kyc Expired":
    case "Expired":
    case "Abandoned":
      return null;
    default:
      return null;
  }
}

export interface DiditEventInput {
  eventId: string;
  webhookType: string;
  status: string | null;
  effectiveSessionId: string | null;
  vendorData: string | null;
  workflowId: string | null;
  parsed: Record<string, unknown>;
}

export async function applyDiditEvent(
  supabase: SupabaseAdmin,
  ev: DiditEventInput,
): Promise<{ ok: true; matched: boolean } | { ok: false; error: string }> {
  try {
    const { status, webhookType, effectiveSessionId, vendorData, workflowId, eventId, parsed } = ev;
    if (
      !status ||
      (webhookType !== "status.updated" && webhookType !== "data.updated")
    ) {
      return { ok: true, matched: false };
    }

    const kycStatus = mapDiditStatusToKyc(status);
    const decision = (parsed.decision ?? null) as Record<string, unknown> | null;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (kycStatus) {
      patch.status = kycStatus;
      if (kycStatus === "approved") patch.verified_at = new Date().toISOString();
    }
    if (decision) {
      patch.metadata = {
        provider: "didit",
        workflow_id: workflowId,
        didit_status: status,
        decision,
        last_event_id: eventId,
        last_event_at: new Date().toISOString(),
      };
    }
    if (status === "Kyc Expired") patch.status = "expired";

    let matched = false;
    if (effectiveSessionId) {
      const { data: bySession, error: selErr } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("didit_session_id", effectiveSessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selErr) throw new Error(`select_by_session: ${selErr.message}`);
      if (bySession?.id) {
        const { error: updErr } = await supabase.from("kyc_verifications").update(patch).eq("id", bySession.id);
        if (updErr) throw new Error(`update_by_session: ${updErr.message}`);
        matched = true;
      }
    }

    if (!matched && vendorData) {
      const { data: byUser, error: selErr } = await supabase
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", vendorData)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selErr) throw new Error(`select_by_vendor: ${selErr.message}`);
      if (byUser?.id) {
        patch.didit_session_id = effectiveSessionId ?? null;
        const { error: updErr } = await supabase.from("kyc_verifications").update(patch).eq("id", byUser.id);
        if (updErr) throw new Error(`update_by_vendor: ${updErr.message}`);
        matched = true;
      }
    }

    log({ event: "processed", event_id: eventId, webhook_type: webhookType, didit_status: status, matched });
    return { ok: true, matched };
  } catch (err) {
    const msg = (err as Error).message;
    log({ event: "processing_failed", event_id: ev.eventId, error: msg });
    return { ok: false, error: msg };
  }
}
