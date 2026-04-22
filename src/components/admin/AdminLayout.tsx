import { ReactNode, useEffect, useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { Button } from "@/components/ui/button";
import { Menu, Shield, Headphones } from "lucide-react";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NotificationCenter } from "@/components/NotificationCenter";
import { adminNavigation } from "@/components/admin/admin-navigation-config";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TranslationHarvester } from "@/components/i18n/TranslationHarvester";

interface AdminLayoutProps {
  children?: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isSupportOnly, setIsSupportOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: admin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as any });
      if (cancelled) return;
      if (admin) {
        setIsAdmin(true);
        setIsSupportOnly(false);
        return;
      }
      const { data: agent } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'support_agent' as any });
      if (cancelled) return;
      setIsAdmin(false);
      setIsSupportOnly(!!agent);
    })();
    return () => { cancelled = true; };
  }, []);

  const isActivePath = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  // Support agents only see the Support section in the sidebar
  const visibleNavigation = isSupportOnly
    ? adminNavigation.filter((s) => s.title === "Support")
    : adminNavigation;

  return (
    <SessionGuard logoutPath="/auth" appName="KOB Admin" appContext="admin">
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <TranslationHarvester category="admin" />
        <Sidebar className="border-r" collapsible="icon">
          {/* KOB Admin Branding Header */}
          <div className="p-4 border-b bg-primary/5">
            <Link to={isSupportOnly ? "/admin/support-chat" : "/admin"} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {isSupportOnly ? <Headphones className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">
                  {isSupportOnly ? "Support Workspace" : "KOB Admin"}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">
                  {isSupportOnly ? "Support Agent" : "Super Admin"}
                </Badge>
              </div>
            </Link>
          </div>

          <SidebarContent className="scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {visibleNavigation.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={isActivePath(item.path)}>
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
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="dashboard-header">
            <SidebarTrigger className="-ml-1">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex-1 min-w-0">
              <Breadcrumbs />
            </div>
            <div className="flex items-center gap-2">
              {!isSupportOnly && <AdminCommandPalette />}
              <LanguageSwitcher />
              <NotificationCenter />
              <UserProfileMenu variant="admin" />
            </div>
          </header>

          <main className="flex-1 p-6 sm:p-8 dashboard-content">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </SessionGuard>
  );
}
