import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useMandatoryPin } from "@/hooks/useMandatoryPin";
import { resolveAndLogDashboard } from "@/lib/dashboardRouting";

export function DashboardRouter() {
  const navigate = useNavigate();
  const { isLoading: pinLoading, requiresPinSetup } = useMandatoryPin();

  useEffect(() => {
    if (pinLoading) return;
    if (requiresPinSetup) {
      navigate("/setup-pin", { replace: true });
      return;
    }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }
        const decision = await resolveAndLogDashboard(user.id, "DashboardRouter");
        navigate(decision.path, { replace: true });
      } catch (error) {
        console.error("Error determining user role:", error);
        navigate("/credit-score", { replace: true });
      }
    })();
  }, [pinLoading, requiresPinSetup]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

// Helper hook to get dashboard path for navigation (no audit log; read-only).
export function useDashboardPath() {
  const [dashboardPath, setDashboardPath] = useState("/dashboard");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setDashboardPath("/auth"); return; }
        const { collectRoutingSignals, decideDashboard } = await import("@/lib/dashboardRouting");
        const signals = await collectRoutingSignals(user.id);
        setDashboardPath(decideDashboard(signals).path);
      } catch (e) {
        console.error("Error getting dashboard path:", e);
        setDashboardPath("/credit-score");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return { dashboardPath, isLoading };
}
