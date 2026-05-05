import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type Audience = "personal" | "merchant" | "developer" | "institution" | "admin";

interface Props {
  allowed: Audience[];
  /** Where to send users without permission. Defaults to /dashboard. */
  redirectTo?: string;
  children: ReactNode;
}

/**
 * Server-of-truth audience guard. Even if sidebar items are hidden, manually
 * navigating here is blocked unless the user belongs to one of the allowed
 * audiences. Audience is derived from profiles.account_type, user_roles,
 * developer_orgs, institutions.status and gateway_merchants — same logic
 * as DashboardLayout's sidebar filter.
 */
export function AudienceGuard({ allowed, redirectTo = "/dashboard", children }: Props) {
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setState("deny"); return; }

      const [{ data: profile }, { data: roles }, { data: devOrg }, { data: inst }, { data: merch }] = await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("developer_orgs").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("institutions").select("status").eq("user_id", user.id).maybeSingle(),
        supabase.from("gateway_merchants").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);

      const roleSet = new Set<string>((roles ?? []).map((r: any) => r.role));
      const a = new Set<Audience>(["personal"]);
      const acct = (profile?.account_type ?? "").toLowerCase();
      if (roleSet.has("admin")) a.add("admin");
      if (acct === "merchant" || acct === "business" || roleSet.has("merchant") || merch?.id) a.add("merchant");
      if (acct === "developer" || roleSet.has("developer") || devOrg?.id) a.add("developer");
      if (
        acct === "institution" || acct === "bank" || acct === "fi" ||
        roleSet.has("institution") || (inst as any)?.status
      ) a.add("institution");

      // Admins always pass.
      const ok = a.has("admin") || allowed.some((x) => a.has(x));
      if (!cancelled) setState(ok ? "ok" : "deny");
    })();
    return () => { cancelled = true; };
  }, [allowed.join("|")]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (state === "deny") return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
