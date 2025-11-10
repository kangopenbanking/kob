import { ReactNode } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
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
  TrendingUp
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
