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
  ScrollText,
  Building2,
  Mail,
  CreditCard,
  Database as DatabaseIcon
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
import { RealtimeAlertNotifications } from "@/components/admin/RealtimeAlertNotifications";

const adminNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/admin", icon: LayoutDashboard },
      { title: "Fee Management", path: "/fee-management", icon: DollarSign },
      { title: "System Monitoring", path: "/system-monitoring", icon: Activity },
      { title: "System Alerts", path: "/admin/system-alerts", icon: AlertTriangle },
    ]
  },
  {
    title: "Management",
    items: [
      { title: "User Management", path: "/admin/users", icon: Users },
      { title: "Branch Management", path: "/admin/branches", icon: Building2 },
      { title: "API Clients", path: "/admin/api-clients", icon: Key },
      { title: "Webhooks", path: "/admin/webhooks", icon: Webhook },
      { title: "Communications", path: "/communications", icon: Mail },
      { title: "Payment Facilitation", path: "/admin/payment-facilitation", icon: CreditCard },
      { title: "Sandbox", path: "/admin/sandbox", icon: Database },
    ]
  },
  {
    title: "API & Performance",
    items: [
      { title: "API Testing", path: "/admin/api-testing", icon: Activity },
      { title: "API Performance", path: "/admin/api-performance", icon: Activity },
      { title: "Rate Limiting", path: "/admin/rate-limits", icon: Shield },
      { title: "API Documentation", path: "/admin/api-docs", icon: FileText },
    ]
  },
  {
    title: "Security & Compliance",
    items: [
      { title: "Security Monitoring", path: "/admin/security", icon: Shield },
      { title: "Transaction Monitoring", path: "/admin/transactions", icon: Activity },
      { title: "Consent Data Management", path: "/admin/consent-data", icon: DatabaseIcon },
      { title: "Audit Logs", path: "/admin/audit-logs", icon: FileText },
      { title: "Credit Management", path: "/admin/credit-management", icon: DollarSign },
    ]
  },
  {
    title: "Configuration",
    items: [
      { title: "System Config", path: "/admin/system-config", icon: Settings },
      { title: "Compliance Dashboard", path: "/compliance-dashboard", icon: ScrollText },
      { title: "API Health", path: "/admin/api-health", icon: Activity },
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
            <RealtimeAlertNotifications />
          </header>

          <main className="flex-1 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
