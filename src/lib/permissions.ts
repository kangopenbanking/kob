// Single source of truth for audience-based access control.
// Used by both the sidebar (to hide links) and AudienceGuard
// (to block direct navigation). Keep this in sync with the
// `set_primary_role` edge function action mapping.

export type Audience = "personal" | "merchant" | "developer" | "institution" | "admin";

export interface AudienceContext {
  accountType?: string | null;
  roles?: string[];
  hasDeveloperOrg?: boolean;
  hasMerchant?: boolean;
  institution?: { status?: string | null; institution_type?: string | null } | null;
}

/**
 * Compute the set of audiences a user belongs to. "personal" is always
 * granted to authenticated users. Admin is a superset and always passes
 * any audience check.
 */
export function resolveAudiences(ctx: AudienceContext): Set<Audience> {
  const a = new Set<Audience>(["personal"]);
  const roles = new Set((ctx.roles ?? []).map((r) => r.toLowerCase()));
  const acct = (ctx.accountType ?? "").toLowerCase();
  if (roles.has("admin") || roles.has("moderator") || roles.has("support_agent")) a.add("admin");
  if (acct === "merchant" || acct === "business" || roles.has("merchant") || ctx.hasMerchant) a.add("merchant");
  if (acct === "developer" || roles.has("developer") || roles.has("tpp") || ctx.hasDeveloperOrg) a.add("developer");
  if (
    acct === "institution" || acct === "bank" || acct === "fi" ||
    roles.has("institution") || roles.has("staff") || ctx.institution?.status
  ) {
    if (ctx.institution?.institution_type === "developer") a.add("developer");
    else a.add("institution");
  }
  return a;
}

/** Returns true if the user can access a feature gated to `allowed`. */
export function isAllowed(audiences: Set<Audience>, allowed: Audience[]): boolean {
  if (audiences.has("admin")) return true;
  return allowed.some((x) => audiences.has(x));
}

/** Permission matrix — features → which audiences may access them. */
export const PERMISSION_MATRIX = {
  // Personal
  "credit-score":     ["personal", "merchant", "institution"] as Audience[],
  "credit-report":    ["personal", "merchant", "institution"] as Audience[],
  "mobile-money":     ["personal"] as Audience[],
  "payments":         ["personal"] as Audience[],
  "savings":          ["personal"] as Audience[],
  "virtual-cards":    ["personal"] as Audience[],
  "loans":            ["personal"] as Audience[],
  // Merchant / FI
  "banking-payments": ["merchant", "institution"] as Audience[],
  "accept-payments":  ["merchant"] as Audience[],
  "banking-ops":      ["merchant", "institution"] as Audience[],
  // Developer
  "open-banking":     ["developer"] as Audience[],
  "build-integrate":  ["developer"] as Audience[],
} as const;

export type FeatureKey = keyof typeof PERMISSION_MATRIX;
