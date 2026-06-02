import { Outlet } from "react-router-dom";
import { DailyNeedsCartProvider } from "@/hooks/useDailyNeedsCart";

/**
 * Wraps the Daily Needs route subtree so cart state (and the floating
 * cart bar mounted inside each page) is shared across browse → store →
 * cart → checkout without leaking into other Customer App routes.
 */
export default function DailyNeedsLayout() {
  return (
    <DailyNeedsCartProvider>
      <Outlet />
    </DailyNeedsCartProvider>
  );
}
