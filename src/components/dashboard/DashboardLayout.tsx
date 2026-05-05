import { ReactNode, useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { PortalErrorBoundary } from "@/components/PortalErrorBoundary";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
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
  Bell,
  Sparkles,
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
import { NotificationCenter } from "@/components/NotificationCenter";

type Audience = "personal" | "merchant" | "developer" | "institution";

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  // Audiences allowed to see this item. If omitted, visible to everyone.
  audiences?: Audience[];
}

interface NavSection {
  title: string;
  audiences?: Audience[];
  items: NavItem[];
}

// Personal-account-only menu by default. Items relevant to other account types
// are tagged with audiences[] so they only appear for users who have that
// dashboard granted (merchant/developer/institution).
export const dashboardNavigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "My Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { title: "CrediQ Dashboard", path: "/crediq/dashboard", icon: TrendingUp },
    ],
  },
  {
    title: "Credit & Scoring",
    items: [
      { title: "Credit Score", path: "/credit-score", icon: TrendingUp },
      { title: "Credit Report", path: "/credit-report", icon: FileText },
    ],
  },
  {
    title: "Financial Services",
    items: [
      { title: "Mobile Money", path: "/mobile-money", icon: Smartphone },
      { title: "Payments", path: "/payments", icon: Wallet },
      { title: "Savings", path: "/savings", icon: PiggyBank },
      { title: "Loans", path: "/loans", icon: DollarSign },
      { title: "Virtual Cards", path: "/virtual-cards", icon: CreditCard },
    ],
  },
  {
    title: "Business Tools",
    audiences: ["merchant"],
    items: [
      { title: "Banking & Payments", path: "/banking-payments", icon: Wallet, audiences: ["merchant"] },
      { title: "Accept Payments", path: "/accept-payments", icon: CreditCard, audiences: ["merchant"] },
      { title: "Banking Operations", path: "/banking-ops", icon: Landmark, audiences: ["merchant", "institution"] },
    ],
  },
  {
    title: "Developer",
    audiences: ["developer"],
    items: [
      { title: "Open Banking APIs", path: "/open-banking", icon: Landmark, audiences: ["developer"] },
      { title: "Build & Integrate", path: "/build-integrate", icon: FileText, audiences: ["developer"] },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Profile Settings", path: "/profile", icon: User },
      { title: "Security Settings", path: "/security", icon: Shield },
      { title: "Notifications", path: "/notifications", icon: Bell },
    ],
  },
];

export function filterNavigationForAudiences(
  sections: NavSection[],
  audiences: Set<Audience>,
): NavSection[] {
  const visible = (a?: Audience[]) => !a || a.length === 0 || a.some((x) => audiences.has(x));
  return sections
    .filter((s) => visible(s.audiences))
    .map((s) => ({ ...s, items: s.items.filter((i) => visible(i.audiences)) }))
    .filter((s) => s.items.length > 0);
}

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [audiences, setAudiences] = useState<Set<Audience>>(new Set(["personal"]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: roles }, { data: devOrg }, { data: inst }, { data: merch }] = await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("developer_orgs").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("institutions").select("status").eq("user_id", user.id).maybeSingle(),
        supabase.from("gateway_merchants").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const roleSet = new Set<string>((roles ?? []).map((r: any) => r.role));
      const a = new Set<Audience>(["personal"]);
      const acct = (profile?.account_type ?? "").toLowerCase();
      if (acct === "merchant" || acct === "business" || roleSet.has("merchant") || merch?.id) a.add("merchant");
      if (acct === "developer" || roleSet.has("developer") || devOrg?.id) a.add("developer");
      if (
        acct === "institution" || acct === "bank" || acct === "fi" ||
        roleSet.has("institution") || (inst as any)?.status
      ) a.add("institution");
      setAudiences(a);
    })();
    return () => { cancelled = true; };
  }, []);

  const isActivePath = (path: string) => {
    if (path === "/dashboard") return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const sections = filterNavigationForAudiences(dashboardNavigation, audiences);

  return (
    <SessionGuard logoutPath="/auth" appName="Kang Dashboard" appContext="dashboard">
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-muted/30">
          <Sidebar className="border-r border-border/60" collapsible="icon">
            <div className="p-4 border-b border-border/60">
              <div className="flex items-center gap-3 px-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">Kang</p>
                  <p className="text-[11px] text-sidebar-foreground/60">Personal Dashboard</p>
                </div>
              </div>
            </div>

            <SidebarContent className="px-2 py-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {sections.map((section) => (
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
                <UserProfileMenu variant="dashboard" />
              </div>
            </header>

            <main className="flex-1 p-6">
              <PortalErrorBoundary portalName="Dashboard" fallbackPath="/dashboard">
                {children || <Outlet />}
              </PortalErrorBoundary>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </SessionGuard>
  );
}
