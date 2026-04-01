import { ReactNode, useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PortalErrorBoundary } from "@/components/PortalErrorBoundary";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Home, Zap, Shield, Puzzle, CreditCard, Wallet, FileText, BookOpen, ShoppingCart, Database, Smartphone, Globe, Terminal, Activity, Scale, Lock } from "lucide-react";
import { DeveloperBreadcrumb } from "./DeveloperBreadcrumb";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { NotificationCenter } from "@/components/NotificationCenter";
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

// Protected paths that require authentication
const PROTECTED_PATHS = new Set([
  "/developer/api-keys",
  "/developer/console",
  "/developer/api-playground",
  "/developer/api-testing",
  "/developer/playground",
  "/developer/certificates",
  "/developer/sandbox",
  "/developer/sandbox/usage",
  "/developer/sandbox/webhooks",
  "/developer/sandbox/webhook-testing",
  "/developer/sandbox/data-generator",
  "/developer/sandbox/payout-simulation",
]);

const navSections = [
  {
    title: "Overview",
    icon: Home,
    items: [
      { title: "Developer Home", path: "/developer" },
      { title: "Getting Started", path: "/developer/getting-started" },
      { title: "Changelog", path: "/developer/changelog" },
      { title: "Status", path: "/developer/status" },
      { title: "Support", path: "/developer/support" },
      { title: "Access Policy", path: "/developer/access-policy" },
    ],
  },
  {
    title: "Authentication",
    icon: Lock,
    items: [
      { title: "Overview", path: "/developer/authentication" },
      { title: "API Keys", path: "/developer/authentication/api-keys" },
      { title: "OAuth 2.0 / PKCE", path: "/developer/authentication/oauth2" },
      { title: "FAPI 1.0 Advanced", path: "/developer/authentication/fapi" },
      { title: "mTLS", path: "/developer/authentication/mtls" },
    ],
  },
  {
    title: "Sandbox",
    icon: Zap,
    items: [
      { title: "Overview & Credentials", path: "/developer/sandbox/overview" },
      { title: "Sandbox Tools", path: "/developer/sandbox", protected: true },
    ],
  },
  {
    title: "API Reference",
    icon: BookOpen,
    items: [
      { title: "Overview", path: "/developer/api-reference" },
      { title: "Error Codes", path: "/developer/api/error-codes" },
      { title: "Rate Limits", path: "/developer/api/rate-limits" },
      { title: "Idempotency", path: "/developer/api/idempotency" },
      { title: "Currencies", path: "/developer/api/currencies" },
      { title: "Countries", path: "/developer/api/countries" },
      { title: "API Explorer", path: "/developer/api-explorer" },
      { title: "SDKs & Libraries", path: "/developer/guides/sdks" },
      { title: "Postman Collection", path: "/developer/guides/postman" },
    ],
  },
  {
    title: "Payment Gateway",
    icon: CreditCard,
    items: [
      { title: "Quickstart", path: "/developer/gateway/quickstart" },
      { title: "Charges", path: "/developer/gateway/charges" },
      { title: "Refunds", path: "/developer/gateway/refunds" },
      { title: "Payouts", path: "/developer/gateway/payouts" },
      { title: "Webhooks", path: "/developer/gateway/webhooks" },
      { title: "Subscriptions", path: "/developer/gateway/subscriptions" },
      { title: "Payment Links", path: "/developer/gateway/payment-links" },
      { title: "Virtual Accounts", path: "/developer/gateway/virtual-accounts" },
      { title: "Tokenisation", path: "/developer/gateway/tokenization" },
      { title: "Disputes", path: "/developer/gateway/disputes" },
      { title: "Settlements", path: "/developer/gateway/settlements" },
    ],
  },
  {
    title: "Open Banking",
    icon: Database,
    items: [
      { title: "Overview", path: "/developer/open-banking" },
      { title: "AISP Guide", path: "/developer/open-banking/aisp" },
      { title: "PISP Guide", path: "/developer/open-banking/pisp" },
      { title: "Consents", path: "/developer/open-banking/consents" },
      { title: "Pay by Bank", path: "/developer/open-banking/pay-by-bank" },
    ],
  },
  {
    title: "Mobile Money",
    icon: Smartphone,
    items: [
      { title: "Overview", path: "/developer/mobile-money" },
      { title: "MTN MoMo", path: "/developer/mobile-money/mtn" },
      { title: "Orange Money", path: "/developer/mobile-money/orange" },
    ],
  },
  {
    title: "Compliance",
    icon: Scale,
    items: [
      { title: "KYC Guide", path: "/developer/compliance/kyc" },
      { title: "AML & SAR", path: "/developer/compliance/aml" },
      { title: "FAPI Security", path: "/developer/compliance/fapi" },
    ],
  },
  {
    title: "ISO 20022",
    icon: FileText,
    items: [
      { title: "Overview", path: "/developer/iso20022" },
      { title: "Message Reference", path: "/developer/iso20022/messages" },
    ],
  },
  {
    title: "Examples",
    icon: Code,
    items: [
      { title: "Code Examples", path: "/developer/examples" },
      { title: "Real-World Integrations", path: "/developer/examples/real-world" },
    ],
  },
  {
    title: "Guides",
    icon: Globe,
    items: [
      { title: "Go-Live Checklist", path: "/developer/guides/go-live" },
      { title: "Migration Guide", path: "/developer/migrate" },
      { title: "Web Integration", path: "/developer/guides/web" },
      { title: "Mobile Integration", path: "/developer/guides/mobile" },
    ],
  },
  {
    title: "Tools & Testing",
    icon: Terminal,
    items: [
      { title: "API Keys", path: "/developer/api-keys", protected: true },
      { title: "API Console", path: "/developer/console", protected: true },
      { title: "API Playground", path: "/developer/api-playground", protected: true },
      { title: "Webhook Testing", path: "/developer/sandbox/webhook-testing", protected: true },
      { title: "Data Generator", path: "/developer/sandbox/data-generator", protected: true },
    ],
  },
  {
    title: "Remittance API",
    icon: Globe,
    items: [
      { title: "Overview", path: "/developer/remittance" },
      { title: "Corridors & Quotes", path: "/developer/remittance/corridors-quotes" },
      { title: "Create Transfer", path: "/developer/remittance/create-transfer" },
      { title: "Pay-in Methods", path: "/developer/remittance/payin-methods" },
      { title: "Payout Methods", path: "/developer/remittance/payout-methods" },
      { title: "Webhooks", path: "/developer/remittance/webhooks" },
    ],
  },
  {
    title: "E-Commerce & POS",
    icon: ShoppingCart,
    items: [
      { title: "Merchants POS", path: "/developer/merchants-pos" },
      { title: "WooCommerce Plugin", path: "/woo-for-kang" },
    ],
  },
];

interface PublicDeveloperLayoutProps {
  children?: ReactNode;
}

export function PublicDeveloperLayout({ children }: PublicDeveloperLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isActivePath = (path: string) => location.pathname === path;
  const isProtectedPath = (path: string) => PROTECTED_PATHS.has(path);

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

          <SidebarContent className="scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {navSections.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="flex items-center gap-2 uppercase text-xs font-bold tracking-wider text-muted-foreground">
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const isLocked = !isAuthenticated && (item as any).protected;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActivePath(item.path)}>
                            <Link
                              to={isLocked ? "/auth" : item.path}
                              className="flex items-center justify-between"
                            >
                              <span className={isLocked ? "text-muted-foreground" : ""}>{item.title}</span>
                              {isLocked && (
                                <Lock className="h-3 w-3 text-muted-foreground/60 ml-1 flex-shrink-0" />
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
            <Link to="/developer" className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              <span className="font-semibold">Developer Portal</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 ml-6">
              <Link to="/developer/getting-started" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</Link>
              <Link to="/developer/api-explorer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">API Reference</Link>
              <Link to="/developer/changelog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Changelog</Link>
              <Link to="/developer/status" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Status</Link>
            </nav>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <NotificationCenter />
                  <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                    Dashboard
                  </Button>
                  <UserProfileMenu variant="developer" />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                    Sign In
                  </Button>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate('/auth')}>
                    Get API Keys
                  </Button>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 p-6">
            <PortalErrorBoundary portalName="Developer Portal" fallbackPath="/developer">
              <DeveloperBreadcrumb />
              {children || <Outlet />}
            </PortalErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
