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
  Building2,
  ArrowUpDown,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Store,
  Shield,
  UserCheck,
  Wallet,
  MapPin,
  Banknote,
  PiggyBank,
  BookOpen,
  Receipt,
  KeyRound,
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
import { Separator } from "@/components/ui/separator";

const institutionNavigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", path: "/fi-portal", icon: LayoutDashboard },
      { title: "Analytics", path: "/fi-portal/analytics", icon: Activity },
    ]
  },
  {
    title: "Banking Operations",
    items: [
      { title: "Accounts", path: "/fi-portal/accounts", icon: Wallet },
      { title: "Branches", path: "/fi-portal/branches", icon: MapPin },
      { title: "Loans", path: "/fi-portal/loans", icon: Banknote },
      { title: "Savings", path: "/fi-portal/savings", icon: PiggyBank },
      { title: "Customers", path: "/fi-portal/customers", icon: UserCheck },
    ]
  },
  {
    title: "Payments & Transactions",
    items: [
      { title: "Transactions", path: "/fi-portal/transactions", icon: ArrowUpDown },
      { title: "Payments", path: "/fi-portal/payments", icon: CreditCard },
      { title: "Settlement", path: "/fi-portal/settlement", icon: DollarSign },
    ]
  },
  {
    title: "Financial Management",
    items: [
      { title: "Beneficiaries", path: "/fi-portal/beneficiaries", icon: Users },
      { title: "Ledger", path: "/fi-portal/ledger", icon: BookOpen },
      { title: "Billing", path: "/fi-portal/billing", icon: Receipt },
    ]
  },
  {
    title: "API Management",
    items: [
      { title: "API Clients", path: "/fi-portal/api-clients", icon: Key },
      { title: "API Keys", path: "/developer/api-keys", icon: Key },
      { title: "Webhooks", path: "/fi-portal/webhooks", icon: Webhook },
      { title: "Credit API", path: "/fi-portal/credit-api", icon: TrendingUp },
      { title: "Documentation", path: "/documentation", icon: FileText },
    ]
  },
  {
    title: "E-Commerce",
    items: [
      { title: "WooCommerce", path: "/fi-portal/woocommerce", icon: ShoppingCart },
      { title: "Register Store", path: "/integrations/woocommerce-merchant-register", icon: Store },
    ]
  },
  {
    title: "Governance",
    items: [
      { title: "Consents", path: "/fi-portal/consents", icon: KeyRound },
      { title: "Audit Trail", path: "/fi-portal/audit", icon: ScrollText },
      { title: "KYB Documents", path: "/business-kyb-submission", icon: FileText },
      { title: "Compliance", path: "/fi-portal/compliance", icon: Shield },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "Institution Profile", path: "/fi-portal/profile", icon: Building2 },
      { title: "Team Members", path: "/fi-portal/team", icon: Users },
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
    if (path === "/fi-portal") return location.pathname === path;
    return location.pathname.startsWith(path);
  };

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
                <p className="text-[11px] text-sidebar-foreground/60">Banking Admin</p>
              </div>
            </div>
          </div>

          <SidebarContent className="px-2 py-2">
            {institutionNavigation.map((section, idx) => (
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
          </header>

          <main className="flex-1 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
