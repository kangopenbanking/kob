/**
 * Remittance security audit logger.
 *
 * Writes structured who/what/when records to `security_audit_logs` for every
 * remittance endpoint touch (allowed and denied). Non-blocking: never throws,
 * never delays the financial path.
 *
 * Decision codes: allowed | denied_unauthenticated | denied_unauthorized |
 *                 denied_validation | denied_idempotency | denied_rate_limit
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

let svc: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (svc) return svc;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  svc = createClient(url, key, { auth: { persistSession: false } });
  return svc;
}

export type RemittanceAuditDecision =
  | "allowed"
  | "denied_unauthenticated"
  | "denied_unauthorized"
  | "denied_validation"
  | "denied_idempotency"
  | "denied_rate_limit"
  | "denied_provider"
  | "system_error";

export interface RemittanceAuditInput {
  endpoint: string;            // e.g. "remittance-outbound"
  action?: string;             // e.g. "send"
  decision: RemittanceAuditDecision;
  userId?: string | null;
  remittanceId?: string | null;
  req?: Request;
  metadata?: Record<string, unknown>;
  riskScore?: number;
  blocked?: boolean;
}

export async function recordRemittanceAudit(input: RemittanceAuditInput): Promise<void> {
  try {
    const sb = client();
    if (!sb) return;
    const ip = input.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || input.req?.headers.get("cf-connecting-ip")
      || null;
    const ua = input.req?.headers.get("user-agent") || null;
    await sb.from("security_audit_logs").insert({
      user_id: input.userId ?? null,
      event_type: `remittance.${input.endpoint}${input.action ? "." + input.action : ""}`,
      event_category: "remittance",
      ip_address: ip,
      user_agent: ua,
      risk_score: input.riskScore ?? (input.decision === "allowed" ? 0 : 25),
      blocked: input.blocked ?? input.decision !== "allowed",
      metadata: {
        endpoint: input.endpoint,
        action: input.action ?? null,
        decision: input.decision,
        remittance_id: input.remittanceId ?? null,
        ...(input.metadata ?? {}),
      },
    });
  } catch (err) {
    console.warn("[remittance-audit] insert failed:", (err as Error)?.message);
  }
}
