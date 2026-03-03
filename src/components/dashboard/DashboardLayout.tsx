import { ReactNode } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  LayoutDashboard, 
  CreditCard,
  FileText,
  Smartphone,
  Wallet,
  PiggyBank,
  DollarSign,
  Landmark,
  User,
  Shield,
  TrendingUp,
  Bell
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
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Menu } from "lucide-react";

const dashboardNavigation = [
  {
    title: "Overview",
    items: [
      { title: "My Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { title: "CrediQ Dashboard", path: "/crediq/dashboard", icon: TrendingUp },
    ]
  },
  {
    title: "Credit & Scoring",
    items: [
      { title: "Credit Score", path: "/credit-score", icon: TrendingUp },
      { title: "Credit Report", path: "/credit-report", icon: FileText },
    ]
  },
  {
    title: "Financial Services",
    items: [
      { title: "Mobile Money", path: "/mobile-money", icon: Smartphone },
      { title: "Payments", path: "/payments", icon: Wallet },
      { title: "Savings", path: "/savings", icon: PiggyBank },
      { title: "Loans", path: "/loans", icon: DollarSign },
      { title: "Virtual Cards", path: "/virtual-cards", icon: CreditCard },
      { title: "Banking Operations", path: "/banking-ops", icon: Landmark },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "Profile Settings", path: "/profile", icon: User },
      { title: "Security Settings", path: "/security", icon: Shield },
      { title: "Notifications", path: "/notifications", icon: Bell },
    ]
  }
];

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <SessionGuard logoutPath="/auth" appName="Kang Dashboard" appContext="dashboard">
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r" collapsible="icon">
          <div className="p-4 border-b">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
              className="w-full justify-start"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="truncate">Back</span>
            </Button>
          </div>

          <SidebarContent className="scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {dashboardNavigation.map((section) => (
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
              <NotificationCenter />
              <UserProfileMenu variant="dashboard" />
            </div>
          </header>

          <main className="flex-1 p-6 sm:p-8 overflow-auto dashboard-content">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
    </SessionGuard>
  );
}
