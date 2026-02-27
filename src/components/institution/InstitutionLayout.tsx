import { ReactNode } from "react";
import { Outlet, useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { institutionNavigation } from "./navigation-config";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { NotificationCenter } from "@/components/NotificationCenter";

interface InstitutionLayoutProps {
  children?: ReactNode;
}

export function InstitutionLayout({ children }: InstitutionLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOwner, isStaff, loading, canAccess } = useStaffPermissions();

  const isActivePath = (path: string) => {
    if (path === "/fi-portal") return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Extract current section key from path for access check
  const currentPathSection = location.pathname.replace('/fi-portal/', '').split('/')[0];
  const currentSectionKey = currentPathSection === 'fi-portal' || currentPathSection === '' ? 'dashboard' : currentPathSection;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If staff user tries to access a restricted section, redirect to dashboard
  if (isStaff && !isOwner && !canAccess(currentSectionKey)) {
    return <Navigate to="/fi-portal" replace />;
  }

  // Filter navigation based on permissions
  const filteredNavigation = institutionNavigation
    .map(section => ({
      ...section,
      items: section.items.filter(item => canAccess(item.sectionKey)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <Sidebar className="border-r border-border/60">
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">FI Portal</p>
                <p className="text-[11px] text-sidebar-foreground/60">
                  {isStaff && !isOwner ? 'Staff Access' : 'Banking Admin'}
                </p>
              </div>
            </div>
          </div>

          <SidebarContent className="px-2 py-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {filteredNavigation.map((section) => (
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
              <NotificationCenter />
              <UserProfileMenu variant="institution" />
            </div>
          </header>

          <main className="flex-1 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
