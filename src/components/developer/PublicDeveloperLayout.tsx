// ============================================================
// PERMANENT PUBLIC ROUTES -- DO NOT REMOVE OR REDIRECT
// This layout serves ALL /developer/* routes publicly.
// No authentication, no login wall, no redirect.
// Required for international API standards compliance (ORDER P1).
// ============================================================

import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PortalErrorBoundary } from "@/components/PortalErrorBoundary";
import { Button } from "@/components/ui/button";
import { DeveloperAIAssistant } from "@/components/developer/DeveloperAIAssistant";
import { DeveloperCanonical } from "@/components/developer/DeveloperCanonical";
import kangAgentLogo from "@/assets/kang-agent-logo.png";
import {
  ArrowLeft,
  Code,
  Home,
  Zap,
  Shield,
  Puzzle,
  CreditCard,
  Wallet,
  FileText,
  BookOpen,
  ShoppingCart,
  Database,
  Smartphone,
  Globe,
  Terminal,
  Activity,
  Scale,
  Lock,
  Search,
  X,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import { DeveloperBreadcrumb } from "./DeveloperBreadcrumb";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { NotificationCenter } from "@/components/NotificationCenter";
import { supabase } from "@/integrations/supabase/client";
import { DOC_NAV_ORDER } from "./docNavigationOrder";
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
// Protected paths that require authentication
// NOTE: /developer/sandbox/* public paths removed per ORDER P3 (Free Sandbox Rule)
const PROTECTED_PATHS = new Set([
  "/developer/api-keys",
  "/developer/console",
  "/developer/api-playground",
  "/developer/api-testing",
  "/developer/playground",
  "/developer/certificates",
]);

const navSections = [
  {
    title: "Overview",
    icon: Home,
    items: [
      { title: "Developer Home", path: "/developer" },
      { title: "Getting Started", path: "/developer/getting-started" },
      { title: "Changelog", path: "/developer/changelog" },
      { title: "Changelog (Markdown)", path: "/CHANGELOG.md", external: true },
      { title: "Forum", path: "/developer/forum" },
      { title: "Widgets SDK", path: "/developer/widgets" },
      { title: "Test Report", path: "/developer/test-report" },
      { title: "Bank Onboarding", path: "/developer/bank-onboarding" },
      { title: "Status", path: "/developer/status" },
      { title: "SLA", path: "/developer/sla" },
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
      { title: "Overview", path: "/developer/sandbox/overview" },
      { title: "Console", path: "/developer/sandbox/console" },
      { title: "Credentials", path: "/developer/sandbox/credentials" },
      { title: "Test Cards", path: "/developer/sandbox/test-cards" },
      { title: "Test Mobile Money", path: "/developer/sandbox/mobile-money" },
      { title: "Simulate Webhooks", path: "/developer/sandbox/simulate-webhooks" },
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
      { title: "Pagination", path: "/developer/api-reference/pagination" },
      { title: "Versioning", path: "/developer/api-reference/versioning" },
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
      { title: "Merchants Hub", path: "/developer/merchants" },
      { title: "Quickstart", path: "/developer/gateway/quickstart" },
      { title: "Charges", path: "/developer/gateway/charges" },
      { title: "Refunds", path: "/developer/gateway/refunds" },
      { title: "Payouts", path: "/developer/gateway/payouts" },
      { title: "Webhooks", path: "/developer/gateway/webhooks" },
      { title: "Provider Webhook Receivers", path: "/developer/webhooks/provider-receivers" },
      { title: "Subscriptions", path: "/developer/gateway/subscriptions" },
      { title: "Payment Links", path: "/developer/gateway/payment-links" },
      { title: "Virtual Accounts", path: "/developer/gateway/virtual-accounts" },
      { title: "Tokenisation", path: "/developer/gateway/tokenization" },
      { title: "Disputes", path: "/developer/gateway/disputes" },
      { title: "Settlements", path: "/developer/gateway/settlements" },
      { title: "Split Payments", path: "/developer/gateway/split-payments" },
      { title: "BYO Mobile Money", path: "/developer/connectors/byo-mobile-money" },
    ],
  },
  {
    title: "Advanced Gateway",
    icon: Wallet,
    items: [
      { title: "Merchant Wallet", path: "/developer/gateway/merchant-wallet" },
      { title: "Wallets", path: "/developer/gateway/wallets" },
      { title: "Escrow", path: "/developer/gateway/escrow" },
      { title: "Treasury", path: "/developer/gateway/treasury" },
      { title: "Instant Payouts", path: "/developer/gateway/instant-payouts" },
      { title: "Compliance Screening", path: "/developer/gateway/compliance" },
      { title: "Webhooks V2", path: "/developer/gateway/webhooks-v2" },
      { title: "SLA Monitor", path: "/developer/gateway/sla" },
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
    title: "Examples & Guides",
    icon: Globe,
    items: [
      { title: "Code Examples", path: "/developer/examples" },
      { title: "Real-World Integrations", path: "/developer/examples/real-world" },
      { title: "Go-Live Checklist", path: "/developer/guides/go-live" },
      { title: "Migration Guide", path: "/developer/migrate" },
      { title: "Web Integration", path: "/developer/guides/web" },
      { title: "Mobile Integration", path: "/developer/guides/mobile" },
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
    title: "Tools",
    icon: Terminal,
    items: [
      { title: "API Keys", path: "/developer/api-keys", protected: true },
      { title: "API Console", path: "/developer/console", protected: true },
      { title: "Webhook Testing", path: "/developer/sandbox/webhook-testing", protected: true },
      { title: "Data Generator", path: "/developer/sandbox/data-generator", protected: true },
    ],
  },
];

/** Right-rail "On this page" TOC component */
function TableOfContents() {
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const location = useLocation();

  useEffect(() => {
    // Small delay to let the page render
    const timer = setTimeout(() => {
      const main = document.querySelector("main");
      if (!main) return;
      const elements = main.querySelectorAll("h2[id], h3[id]");
      const items = Array.from(elements).map((el) => ({
        id: el.id,
        text: el.textContent || "",
        level: el.tagName === "H2" ? 2 : 3,
      }));
      setHeadings(items);
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 },
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-20 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">On this page</p>
        {headings.map(({ id, text, level }) => (
          <a
            key={id}
            href={`#${id}`}
            className={`block text-xs leading-relaxed transition-colors ${level === 3 ? "pl-3" : ""} ${
              activeId === id ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {text}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Dark mode toggle */
function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const html = document.documentElement;
    const newDark = !html.classList.contains("dark");
    html.classList.toggle("dark", newDark);
    setIsDark(newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
  };

  useEffect(() => {
    // Default to dark on developer portal
    document.documentElement.classList.add("dark");
    setIsDark(true);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
    </Button>
  );
}

/** Docs search component */
function DocsSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results =
    query.length >= 2
      ? DOC_NAV_ORDER.filter(
          (entry) =>
            entry.title.toLowerCase().includes(query.toLowerCase()) ||
            entry.path.toLowerCase().includes(query.toLowerCase()),
        ).slice(0, 8)
      : [];

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path);
      setIsOpen(false);
      setQuery("");
    },
    [navigate],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-md hover:border-primary/50 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-border px-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-lg bg-background border border-border rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center px-4 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documentation..."
                className="flex-1 px-3 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto p-2">
                {results.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => handleSelect(entry.path)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{entry.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.path}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && results.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No results found for "{query}"</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Docs footer */
function DocsFooter() {
  return (
    <footer className="border-t border-border mt-16 pt-8 pb-6 text-sm text-muted-foreground">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <span>Kang Open Banking Developer Docs</span>
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{KOB_API_VERSION_LABEL}</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={KOB_STATUS_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            aria-label="System status — opens status page in new tab"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            All systems operational
          </a>
          <Link to="/developer/support" className="hover:text-foreground transition-colors">
            Support
          </Link>
          <Link to="/developer/changelog" className="hover:text-foreground transition-colors">
            Changelog
          </Link>
          <a
            href="/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            OpenAPI
          </a>
        </div>
      </div>
    </footer>
  );
}

interface PublicDeveloperLayoutProps {
  children?: ReactNode;
}

export function PublicDeveloperLayout({ children }: PublicDeveloperLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Force dark mode on the developer portal; restore user's saved app theme on leave
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme"); // user's app-wide preference (light is default)
    document.documentElement.classList.add("dark");
    return () => {
      // Always restore the user's saved preference; default to light when unset
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="w-full justify-start">
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
                      const isExternal = !!(item as any).external;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActivePath(item.path)}>
                            {isExternal ? (
                              <a
                                href={isLocked ? "/auth" : item.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between"
                              >
                                <span>{item.title}</span>
                              </a>
                            ) : (
                              <Link to={isLocked ? "/auth" : item.path} className="flex items-center justify-between">
                                <span className={isLocked ? "text-muted-foreground" : ""}>{item.title}</span>
                                {isLocked && <Lock className="h-3 w-3 text-muted-foreground/60 ml-1 flex-shrink-0" />}
                              </Link>
                            )}
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
              <img src={kangAgentLogo} alt="Kang Open Banking" className="h-7 w-7 object-contain" />
              <span className="font-semibold">Kang Docs</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 ml-6">
              <Link
                to="/developer/getting-started"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Docs
              </Link>
              <Link
                to="/developer/api-explorer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                API Reference
              </Link>
              <Link
                to="/developer/guides/sdks"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                SDKs
              </Link>
              <Link
                to="/developer/changelog"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Changelog
              </Link>
            </nav>
            <div className="flex-1" />
            <DocsSearch />
            <DarkModeToggle />
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <NotificationCenter />
                  <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                    Dashboard
                  </Button>
                  <UserProfileMenu variant="developer" />
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => navigate("/auth")}
                  >
                    Get API Keys
                  </Button>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 flex">
            <main className="flex-1 p-6 min-w-0">
              <PortalErrorBoundary portalName="Developer Portal" fallbackPath="/developer">
                {/* Auto-injects canonical + trailing-slash normalisation on every /developer/* page */}
                <DeveloperCanonical />
                <DeveloperBreadcrumb />
                {children || <Outlet />}
                <DocsFooter />
              </PortalErrorBoundary>
            </main>
            <TableOfContents />
          </div>
        </div>
        <DeveloperAIAssistant />
      </div>
    </SidebarProvider>
  );
}
