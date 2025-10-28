import { ReactNode } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Users, 
  Settings, 
  FileText, 
  Activity, 
  Key,
  Webhook,
  CreditCard,
  Building2
} from "lucide-react";
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

const institutionNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/fi-portal", icon: LayoutDashboard },
      { title: "Analytics", path: "/analytics", icon: Activity },
    ]
  },
  {
    title: "API Management",
    items: [
      { title: "API Clients", path: "/fi-portal/api-clients", icon: Key },
      { title: "Webhooks", path: "/fi-portal/webhooks", icon: Webhook },
      { title: "Documentation", path: "/documentation", icon: FileText },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "Institution Profile", path: "/fi-portal/profile", icon: Building2 },
      { title: "Settings", path: "/fi-portal/settings", icon: Settings },
    ]
  }
];

interface InstitutionLayoutProps {
  children?: ReactNode;
}

export function InstitutionLayout({ children }: InstitutionLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r">
          <div className="p-4 border-b">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
              className="w-full justify-start"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>

          <SidebarContent>
            {institutionNavigation.map((section) => (
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
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>

          <main className="flex-1 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
