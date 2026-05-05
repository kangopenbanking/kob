import { supabase } from "@/integrations/supabase/client";

export interface RoutingSignals {
  isAdmin: boolean;
  isMerchantRole: boolean;
  isDeveloperRole: boolean;
  hasDeveloperOrg: boolean;
  isMerchantStaff: boolean;
  institutionStatus?: string | null;
  institutionType?: string | null;
  isStaff: boolean;
}

export interface RoutingDecision {
  path: string;
  reason: string;
  signals: RoutingSignals;
}

/**
 * Pure routing decision based on collected signals.
 * Kept pure for unit testing — no Supabase calls here.
 */
export function decideDashboard(s: RoutingSignals): { path: string; reason: string } {
  if (s.isAdmin) return { path: "/admin", reason: "admin_role" };
  if (s.isMerchantRole) return { path: "/merchant", reason: "merchant_role" };
  if (s.isDeveloperRole) return { path: "/developer", reason: "developer_role" };
  if (s.hasDeveloperOrg) return { path: "/developer", reason: "developer_org_row" };
  if (s.isMerchantStaff) return { path: "/merchant/travel-services", reason: "merchant_staff" };
  if (s.institutionStatus === "approved") {
    if (s.institutionType === "developer") return { path: "/developer", reason: "institution_developer_approved" };
    return { path: "/fi-portal", reason: "institution_approved" };
  }
  if (s.institutionStatus) return { path: "/pending-approval", reason: "institution_pending" };
  if (s.isStaff) return { path: "/fi-portal", reason: "fi_staff_role" };
  return { path: "/credit-score", reason: "default_personal" };
}

export async function collectRoutingSignals(userId: string): Promise<RoutingSignals> {
  const [adminRes, merchRes, devRes, devOrgRes, staffMerchRes, instRes, fiStaffRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" as any }),
    supabase.rpc("has_role", { _user_id: userId, _role: "merchant" as any }),
    supabase.rpc("has_role", { _user_id: userId, _role: "developer" as any }),
    supabase.from("developer_orgs").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("merchant_staff_roles").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
    supabase.from("institutions").select("status, institution_type").eq("user_id", userId).maybeSingle(),
    supabase.rpc("has_role", { _user_id: userId, _role: "staff" as any }),
  ]);

  return {
    isAdmin: !!adminRes.data,
    isMerchantRole: !!merchRes.data,
    isDeveloperRole: !!devRes.data,
    hasDeveloperOrg: !!devOrgRes.data,
    isMerchantStaff: !!staffMerchRes.data,
    institutionStatus: (instRes.data as any)?.status ?? null,
    institutionType: (instRes.data as any)?.institution_type ?? null,
    isStaff: !!fiStaffRes.data,
  };
}

export async function logRoutingDecision(
  userId: string,
  decision: { path: string; reason: string },
  signals: RoutingSignals,
  context: string,
) {
  try {
    await supabase.from("dashboard_redirect_audit").insert({
      user_id: userId,
      target_path: decision.path,
      reason: decision.reason,
      is_admin: signals.isAdmin,
      is_merchant: signals.isMerchantRole,
      is_developer_role: signals.isDeveloperRole,
      has_developer_org: signals.hasDeveloperOrg,
      is_merchant_staff: signals.isMerchantStaff,
      institution_status: signals.institutionStatus,
      institution_type: signals.institutionType,
      is_staff: signals.isStaff,
      context,
    });
  } catch (e) {
    // Best-effort audit; never block routing.
    console.warn("dashboard audit failed", e);
  }
}

export async function resolveAndLogDashboard(userId: string, context: string): Promise<RoutingDecision> {
  const signals = await collectRoutingSignals(userId);
  const decision = decideDashboard(signals);
  await logRoutingDecision(userId, decision, signals, context);
  return { ...decision, signals };
}
