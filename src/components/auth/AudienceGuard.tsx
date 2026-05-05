import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveAudiences, isAllowed, type Audience } from "@/lib/permissions";

export type { Audience };

interface Props {
  allowed: Audience[];
  redirectTo?: string;
  children: ReactNode;
}

/**
 * Server-of-truth audience guard. Even if sidebar items are hidden, manually
 * navigating here is blocked unless the user belongs to one of the allowed
 * audiences. Uses the shared `resolveAudiences` helper so the guard, the
 * sidebar, and the profile menu all agree.
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
        supabase.from("institutions").select("status, institution_type").eq("user_id", user.id).maybeSingle(),
        supabase.from("gateway_merchants").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);

      const audiences = resolveAudiences({
        accountType: profile?.account_type,
        roles: (roles ?? []).map((r: any) => r.role),
        hasDeveloperOrg: !!devOrg?.id,
        hasMerchant: !!merch?.id,
        institution: inst as any,
      });

      if (!cancelled) setState(isAllowed(audiences, allowed) ? "ok" : "deny");
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
