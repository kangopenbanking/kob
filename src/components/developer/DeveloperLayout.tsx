import { ReactNode, useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PortalErrorBoundary } from "@/components/PortalErrorBoundary";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Home, Zap, Shield, Puzzle, CreditCard, Wallet, FileText, BookOpen, ShoppingCart, Database, Smartphone, Globe, Terminal, Activity, Scale } from "lucide-react";
import { DeveloperBreadcrumb } from "./DeveloperBreadcrumb";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { NotificationCenter } from "@/components/NotificationCenter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TranslationHarvester } from "@/components/i18n/TranslationHarvester";
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

const navSections = [
  {
    title: "Introduction",
    icon: Home,
    items: [
      { title: "Overview", path: "/developer" },
      { title: "Quickstart", path: "/developer/getting-started" },
      { title: "Integration Workflow", path: "/developer/integration-workflow" },
      { title: "SDKs & Libraries", path: "/developer/guides/sdks" },
      { title: "Changelog", path: "/developer/changelog" },
      { title: "Forum", path: "/developer/forum" },
    ],
  },
  {
    title: "Core Concepts",
    icon: BookOpen,
    items: [
      { title: "Authentication", path: "/developer/getting-started/authentication" },
      { title: "Error Codes", path: "/developer/api/error-codes" },
      { title: "Rate Limits", path: "/developer/api/rate-limits" },
      { title: "Idempotency", path: "/developer/api/idempotency" },
      { title: "Webhooks", path: "/developer/api/webhooks" },
      { title: "Risk & Audit Logs", path: "/developer/api/risk-audit" },
      { title: "Sandbox & Testing", path: "/developer/sandbox" },
    ],
  },
  {
    title: "Collections — Inflow",
    icon: CreditCard,
    items: [
      { title: "Gateway Quickstart", path: "/developer/gateway/quickstart" },
      { title: "Charges (Collect)", path: "/developer/gateway/charges" },
      { title: "Verify Charge", path: "/developer/gateway/verification" },
      { title: "Payment Links", path: "/developer/gateway/payment-links" },
      { title: "Subscriptions", path: "/developer/gateway/subscriptions" },
      { title: "Mobile Money", path: "/developer/api/mobile-money" },
      { title: "BYO Mobile Money", path: "/developer/connectors/byo-mobile-money" },
      { title: "PISP (Bank Pay)", path: "/developer/api/pisp" },
      { title: "Gateway Webhooks", path: "/developer/gateway/webhooks" },
      { title: "Provider Webhook Receivers", path: "/developer/webhooks/provider-receivers" },
      { title: "KOB Merchants Discovery", path: "/developer/payments/merchants-discovery" },
    ],
  },
  {
    title: "Transfers — Outflow",
    icon: Wallet,
    items: [
      { title: "Payouts", path: "/developer/gateway/payouts" },
      { title: "Instant Payouts", path: "/developer/gateway/instant-payouts" },
      { title: "Funding Intents", path: "/developer/gateway/funding-intents" },
      { title: "Account Funding (Legacy)", path: "/developer/gateway/funding" },
      { title: "Split Payments", path: "/developer/gateway/split-payments" },
      { title: "Beneficiaries", path: "/developer/api/beneficiaries" },
      { title: "Settlements", path: "/developer/gateway/settlements" },
      { title: "Refunds & Reversals", path: "/developer/gateway/refunds" },
      { title: "Merchant Wallet", path: "/developer/gateway/merchant-wallet" },
      { title: "Virtual Accounts", path: "/developer/gateway/virtual-accounts" },
    ],
  },
  {
    title: "Wallets & Escrow",
    icon: Wallet,
    items: [
      { title: "Wallets API", path: "/developer/gateway/wallets" },
      { title: "Escrow API", path: "/developer/gateway/escrow" },
      { title: "Treasury", path: "/developer/gateway/treasury" },
    ],
  },
  {
    title: "Disputes & Reporting",
    icon: FileText,
    items: [
      { title: "Disputes", path: "/developer/gateway/disputes" },
      { title: "Charge Events", path: "/developer/gateway/charge-events" },
      { title: "Tokenization", path: "/developer/gateway/tokenization" },
      { title: "Transaction Exports", path: "/developer/api/exports" },
      { title: "Settlement Reports", path: "/developer/api/settlements" },
      { title: "Webhooks v2", path: "/developer/gateway/webhooks-v2" },
    ],
  },
  {
    title: "Compliance & Security",
    icon: Scale,
    items: [
      { title: "Compliance Screening", path: "/developer/gateway/compliance" },
      { title: "SLA Monitoring", path: "/developer/gateway/sla" },
    ],
  },
  {
    title: "Open Banking APIs",
    icon: Database,
    items: [
      { title: "Overview", path: "/developer/open-banking" },
      { title: "AISP (Accounts)", path: "/developer/api/aisp" },
      { title: "Banking Operations", path: "/developer/api/banking" },
      { title: "Transfers & Fund Movement", path: "/developer/api/transfers" },
      { title: "Payment Facilitation", path: "/developer/payment-facilitation" },
      { title: "Certificates (mTLS)", path: "/developer-tools/certificates" },
    ],
  },
  {
    title: "Tools & Testing",
    icon: Terminal,
    items: [
      { title: "Sandbox Console", path: "/developer/sandbox/console" },
      { title: "API Keys", path: "/developer-tools/api-keys" },
      { title: "API Explorer", path: "/developer/api-explorer" },
      { title: "API Console", path: "/developer-tools/console" },
      { title: "API Playground", path: "/developer-tools/api-playground" },
      { title: "API Testing", path: "/developer-tools/api-testing" },
      { title: "Code Examples", path: "/developer/examples" },
      { title: "Real-World Examples", path: "/developer/examples/real-world" },
      { title: "Data Generator", path: "/developer-tools/sandbox/data-generator" },
      { title: "Webhook Testing", path: "/developer-tools/sandbox/webhook-testing" },
      { title: "Payout Simulation", path: "/developer-tools/sandbox/payout-simulation" },
    ],
  },
  {
    title: "Reference",
    icon: Activity,
    items: [
      { title: "Supported Currencies", path: "/developer/api/currencies" },
      { title: "Supported Countries", path: "/developer/api/countries" },
      { title: "Testing Guide", path: "/developer/api/testing" },
      { title: "API Status", path: "/developer/status" },
    ],
  },
  {
    title: "Integration Guides",
    icon: Globe,
    items: [
      { title: "Web Applications", path: "/developer/guides/web" },
      { title: "Mobile Applications", path: "/developer/guides/mobile" },
      { title: "Pay by Bank (SCA)", path: "/developer/pay-by-bank" },
      { title: "AI Integration", path: "/developer/ai-integration-guide" },
      { title: "PayPal Integration", path: "/developer/gateway/paypal" },
    ],
  },
  {
    title: "E-Commerce & POS",
    icon: ShoppingCart,
    items: [
      { title: "Merchants → POS", path: "/developer/merchants-pos" },
      { title: "WooCommerce Plugin", path: "/woo-for-kang" },
      { title: "Register Store", path: "/integrations/woocommerce-merchant-register" },
      { title: "Plugin Docs", path: "/integrations/woocommerce-docs" },
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
      { title: "Sandbox Testing", path: "/developer/remittance/sandbox" },
      { title: "Error Reference", path: "/developer/remittance/errors" },
    ],
  },
  {
    title: "No-Code",
    icon: Puzzle,
    items: [
      { title: "Overview", path: "/integrations" },
      { title: "Zapier", path: "/integrations/zapier" },
      { title: "Make.com", path: "/integrations/make" },
      { title: "Bubble.io", path: "/integrations/bubble" },
      { title: "Retool", path: "/integrations/retool" },
    ],
  },
];

interface DeveloperLayoutProps {
  children?: ReactNode;
}

export function DeveloperLayout({ children }: DeveloperLayoutProps) {
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <TranslationHarvester category="developer" />
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
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={isActivePath(item.path)}>
                          <Link to={item.path}>
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
              <LanguageSwitcher />
              <NotificationCenter />
              {isAuthenticated ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                    Dashboard
                  </Button>
                  <UserProfileMenu variant="developer" />
                </>
              ) : (
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate('/auth')}>
                  Get Started
                </Button>
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
