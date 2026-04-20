import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { PortalErrorBoundary } from "@/components/PortalErrorBoundary";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Store } from "lucide-react";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { merchantNavigation } from "./merchant-navigation-config";
import { NotificationCenter } from "@/components/NotificationCenter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { useMerchantRealtime } from "@/hooks/useMerchantRealtime";

const STAFF_ALLOWED_SECTION = "Travel Services";

function useIsStaffUser() {
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: isMerchant } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'merchant' as any,
      });
      if (isMerchant) { setIsStaff(false); setLoading(false); return; }

      const { data: staffRole } = await supabase
        .from('merchant_staff_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      setIsStaff(!!staffRole);
      setLoading(false);
    };
    check();
  }, []);

  return { isStaff, loading };
}

export function MerchantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isStaff } = useIsStaffUser();
  const { merchantId } = useMerchantContext();

  // Layout-level realtime sync — every /merchant page reacts live to changes.
  useMerchantRealtime(merchantId);

  const isActivePath = (path: string) => {
    if (path === "/merchant") return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const visibleNavigation = isStaff
    ? merchantNavigation.filter(s => s.title === STAFF_ALLOWED_SECTION)
    : merchantNavigation;

  return (
    <SessionGuard logoutPath="/auth" appName="Merchant Portal" appContext="merchant">
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <Sidebar className="border-r border-border/60">
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{isStaff ? "Staff Portal" : "Merchant Portal"}</p>
                <p className="text-[11px] text-sidebar-foreground/60">{isStaff ? "Travel Services" : "Business Dashboard"}</p>
              </div>
            </div>
          </div>

          <SidebarContent className="px-2 py-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {visibleNavigation.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-3 py-2">
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActivePath(item.path)}
                          className="h-9 rounded-md text-[13px] font-medium"
                        >
                          <Link to={item.path}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <div className="mt-auto border-t border-border/60 p-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="w-full justify-start text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              Back
            </Button>
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-4 border-b border-border/60 bg-background/95 backdrop-blur-sm px-6">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <NotificationCenter />
              <UserProfileMenu />
            </div>
          </header>

          <main className="flex-1 p-6">
            <PortalErrorBoundary portalName="Merchant Portal" fallbackPath="/merchant">
              <Outlet />
            </PortalErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </SessionGuard>
  );
}
