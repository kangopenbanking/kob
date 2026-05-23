import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BottomNavApp = "customer" | "business" | "banking";

export interface BottomNavItem {
  id: string;
  app: BottomNavApp;
  label: string;
  icon: string;
  path: string;
  position: number;
  is_center: boolean;
  is_enabled: boolean;
  badge_key: string | null;
  required_role: string | null;
}

export const DEFAULT_NAV_ITEMS: Record<BottomNavApp, BottomNavItem[]> = {
  customer: [
    { id: "d-home",     app: "customer", label: "Home",     icon: "Home",       path: "/app/home",            position: 0, is_center: false, is_enabled: true, badge_key: null, required_role: null },
    { id: "d-activity", app: "customer", label: "Activity", icon: "Activity",   path: "/app/activity",        position: 1, is_center: false, is_enabled: true, badge_key: null, required_role: null },
    { id: "d-budget",   app: "customer", label: "Budget",   icon: "PieChart",   path: "/app/budget",          position: 2, is_center: false, is_enabled: true, badge_key: null, required_role: null },
    { id: "d-scan",     app: "customer", label: "Scan",     icon: "ScanLine",   path: "/app/scan",            position: 3, is_center: true,  is_enabled: true, badge_key: null, required_role: null },
    { id: "d-acc",      app: "customer", label: "Accounts", icon: "CreditCard", path: "/app/linked-accounts", position: 4, is_center: false, is_enabled: true, badge_key: null, required_role: null },
    { id: "d-more",     app: "customer", label: "More",     icon: "Menu",       path: "/app/more",            position: 5, is_center: false, is_enabled: true, badge_key: null, required_role: null },
  ],
  business: [],
  banking: [],
};

export function useBottomNavItems(app: BottomNavApp) {
  return useQuery({
    queryKey: ["bottom_nav_items", app],
    queryFn: async (): Promise<BottomNavItem[]> => {
      const { data, error } = await supabase
        .from("bottom_nav_items")
        .select("*")
        .eq("app", app)
        .eq("is_enabled", true)
        .order("position", { ascending: true });
      if (error || !data || data.length === 0) {
        return DEFAULT_NAV_ITEMS[app];
      }
      return data as BottomNavItem[];
    },
    staleTime: 5 * 60_000,
  });
}
