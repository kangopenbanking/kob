import { ReactNode } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { Button } from "@/components/ui/button";
import { Menu, Shield } from "lucide-react";
import { UserProfileMenu } from "@/components/UserProfileMenu";
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

interface AdminLayoutProps {
  children?: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();

  const isActivePath = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <SessionGuard logoutPath="/auth" appName="KOB Admin" appContext="admin">
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r" collapsible="icon">
          {/* KOB Admin Branding Header */}
          <div className="p-4 border-b bg-primary/5">
            <Link to="/admin" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">KOB Admin</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">Super Admin</Badge>
              </div>
            </Link>
          </div>

          <SidebarContent className="scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {adminNavigation.map((section) => (
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
              <AdminCommandPalette />
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
