import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { collectRoutingSignals, decideDashboard, type RoutingSignals } from "@/lib/dashboardRouting";

/**
 * Map a routing decision + signals to a human-readable role label.
 * Exported for unit tests.
 */
export function roleLabelFromDecision(
  decision: { path: string; reason: string },
  signals: RoutingSignals,
): string {
  if (signals.isAdmin || decision.path.startsWith("/admin")) return "Admin";
  if (decision.path.startsWith("/merchant")) return "Merchant";
  if (decision.path.startsWith("/developer")) return "Developer";
  if (decision.path.startsWith("/fi-portal")) return "Institution";
  if (decision.path.startsWith("/pending-approval")) return "Institution (pending)";
  if (decision.path.startsWith("/credit-score")) return "Personal";
  return "User";
}

/**
 * Subscribes the current user to realtime changes on `profiles.account_type`
 * and `user_roles`. When an admin changes the user's primary role via
 * `admin-manage-user → set_primary_role`, this listener:
 *   1. Recomputes the correct dashboard via `decideDashboard`.
 *   2. Notifies the user.
 *   3. Navigates to the new default dashboard — no re-login required.
 *
 * Mounted once at the app shell level (App.tsx) so it follows the user
 * across every authenticated page.
 */
export function useRoleChangeListener() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let userId: string | null = null;
    let lastPath: string | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async (cause: "profile" | "roles") => {
      if (!userId) return;
      try {
        const signals = await collectRoutingSignals(userId);
        const decision = decideDashboard(signals);
        if (decision.path === lastPath) return;
        const previous = lastPath;
        lastPath = decision.path;
        if (previous !== null) {
          const roleName = roleLabelFromDecision(decision, signals);
          const effectiveAt = new Date();
          const timeStr = effectiveAt.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          toast.info(`Your role was changed to ${roleName}`, {
            description: `Effective ${timeStr} — redirecting to your new dashboard…`,
          });
          navigate(decision.path, { replace: true });
        }
      } catch (e) {
        console.warn("[useRoleChangeListener] refresh failed", cause, e);
      }
    };

    const scheduleRefresh = (cause: "profile" | "roles") => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refresh(cause), 250);
    };

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      userId = user.id;

      // Seed lastPath so we only react to *changes*, not initial state.
      try {
        const signals = await collectRoutingSignals(userId);
        lastPath = decideDashboard(signals).path;
      } catch { /* best effort */ }

      channel = supabase
        .channel(`role-change-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          () => scheduleRefresh("profile"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${userId}` },
          () => scheduleRefresh("roles"),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [navigate]);
}
