import { ReactNode } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Users, 
  Settings, 
  Shield, 
  Activity, 
  FileText, 
  Webhook, 
  DollarSign,
  Key,
  Database,
  AlertTriangle,
  ScrollText
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

const adminNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/admin", icon: LayoutDashboard },
      { title: "Fee Management", path: "/fee-management", icon: DollarSign },
      { title: "System Monitoring", path: "/system-monitoring", icon: Activity },
    ]
  },
  {
    title: "Management",
    items: [
      { title: "User Management", path: "/admin/users", icon: Users },
      { title: "API Clients", path: "/admin/api-clients", icon: Key },
      { title: "Webhooks", path: "/admin/webhooks", icon: Webhook },
      { title: "Sandbox", path: "/admin/sandbox", icon: Database },
    ]
  },
  {
    title: "Security & Compliance",
    items: [
      { title: "Security Monitoring", path: "/admin/security", icon: Shield },
      { title: "Transaction Monitoring", path: "/admin/transactions", icon: Activity },
      { title: "Audit Logs", path: "/admin/audit-logs", icon: FileText },
      { title: "Credit Management", path: "/admin/credit", icon: DollarSign },
    ]
  },
  {
    title: "Configuration",
    items: [
      { title: "System Config", path: "/admin/system-config", icon: Settings },
      { title: "Compliance Dashboard", path: "/compliance-dashboard", icon: ScrollText },
    ]
  }
];

interface AdminLayoutProps {
  children?: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
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
