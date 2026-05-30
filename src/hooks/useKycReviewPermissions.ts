import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Roles authorised to perform KYC review actions
 * (approve / reject / request more info).
 *
 * Mirrors the server-side gate in `supabase/functions/admin-kyc-review`.
 * Keep both lists in sync — the edge function is the source of truth and
 * will reject unauthorised callers even if the UI is bypassed.
 */
export const KYC_REVIEWER_ROLES = [
  "admin",
  "compliance_officer",
  "moderator",
  "institution",
] as const;

export type KycReviewerRole = (typeof KYC_REVIEWER_ROLES)[number];

interface KycReviewPermissions {
  loading: boolean;
  canReview: boolean;
  roles: KycReviewerRole[];
}

/**
 * Returns whether the current user holds any role authorised to act on
 * KYC submissions. UI affordances (approve / reject / request more info
 * buttons) must check `canReview` and hide themselves when false.
 */
export function useKycReviewPermissions(): KycReviewPermissions {
  const [state, setState] = useState<KycReviewPermissions>({
    loading: true,
    canReview: false,
    roles: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        if (!cancelled) setState({ loading: false, canReview: false, roles: [] });
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", KYC_REVIEWER_ROLES as unknown as KycReviewerRole[]);

      if (cancelled) return;
      if (error) {
        setState({ loading: false, canReview: false, roles: [] });
        return;
      }
      const roles = (data ?? [])
        .map((r) => r.role as KycReviewerRole)
        .filter((r): r is KycReviewerRole =>
          (KYC_REVIEWER_ROLES as readonly string[]).includes(r),
        );
      setState({ loading: false, canReview: roles.length > 0, roles });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
