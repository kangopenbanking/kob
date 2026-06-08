import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * RBAC for the Nium name-correction maker-checker workflow.
 * - canMaker:   compliance_officer OR admin  → may record a maker proposal
 * - canChecker: admin only                   → may finalize approve/reject
 * Mirrors the server-side checks in `nium-request-name-correction` so the
 * UI and the edge function agree on who can do what.
 */
export function useNameCorrectionRoles() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCompliance, setIsCompliance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setLoading(false); } return; }
        if (!cancelled) setUserId(user.id);
        const [{ data: a }, { data: c }] = await Promise.all([
          supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as any }),
          supabase.rpc("has_role", { _user_id: user.id, _role: "compliance_officer" as any }),
        ]);
        if (!cancelled) {
          setIsAdmin(!!a);
          setIsCompliance(!!c);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return {
    loading,
    userId,
    isAdmin,
    isCompliance,
    canMaker: isAdmin || isCompliance,
    canChecker: isAdmin,
  };
}
