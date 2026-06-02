import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * DriverGuard — gates /app/driver/* routes to authenticated users who have an
 * active DDN driver record. Unauthenticated users are sent to /app/auth.
 * Authenticated non-drivers are sent to /app/driver/register (except when
 * already on that page).
 */
export function DriverGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "noauth" | "notdriver" | "banned">("loading");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setState("noauth"); return; }
      const { data: driver } = await supabase
        .from("ddn_drivers").select("id, status")
        .eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (!driver) setState("notdriver");
      else if (["banned", "suspended"].includes(String(driver.status))) setState("banned");
      else setState("ok");
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (state === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (state === "noauth") return <Navigate to="/app/auth" replace state={{ from: location.pathname }} />;
  if (state === "banned") return <Navigate to="/app/home" replace />;
  if (state === "notdriver") {
    if (location.pathname.endsWith("/driver/register")) return <>{children}</>;
    return <Navigate to="/app/driver/register" replace />;
  }
  return <>{children}</>;
}
