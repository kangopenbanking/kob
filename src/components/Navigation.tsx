import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Menu,
  ArrowRight,
  Database,
  Send,
  Smartphone,
  Shield,
  FileText,
  DollarSign,
  Activity,
  HelpCircle,
  MessageCircle,
  BookOpen,
  Lightbulb,
  Wallet,
  TrendingUp,
  CreditCard,
  Target,
  BarChart3,
  Package,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import kobLogo from "@/assets/kob-logo.png";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BrandName } from "./BrandName";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─────────────────────────────────────────────────────────────────────────────
// Mega-menu data model — keeps the markup clean and easy to maintain.
// `tone` maps to a semantic accent token defined in tailwind.config / index.css
// (primary, success, warning, info, accent). Icons are rendered as outline.
// ─────────────────────────────────────────────────────────────────────────────

type Tone = "primary" | "success" | "warning" | "info" | "accent";

interface MegaItem {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  tone?: Tone;
  badge?: string;
}

interface MegaSection {
  heading: string;
  items: MegaItem[];
}

interface MegaFeature {
  eyebrow: string;
  title: string;
  description: string;
  to: string;
  cta: string;
  icon: LucideIcon;
}

interface MegaMenu {
  label: string;
  sections: MegaSection[];
  feature?: MegaFeature;
}

const TONE_RING: Record<Tone, string> = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  info: "border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400",
  accent: "border-violet-500/30 bg-violet-500/5 text-violet-600 dark:text-violet-400",
};

const MEGA_MENUS: MegaMenu[] = [
  {
    label: "Credit Score",
    sections: [
      {
        heading: "Personal credit",
        items: [
          {
            title: "My Credit Score",
            description: "View your current score and trends over time.",
            to: "/crediq",
            icon: TrendingUp,
            tone: "primary",
          },
          {
            title: "Credit Report",
            description: "Detailed credit history and account activity.",
            to: "/credit-report",
            icon: FileText,
            tone: "info",
          },
        ],
      },
      {
        heading: "Improve & learn",
        items: [
          {
            title: "CrediQ Dashboard",
            description: "Track goals and personalised improvement plans.",
            to: "/crediq/dashboard",
            icon: Target,
            tone: "success",
          },
          {
            title: "How Scores Work",
            description: "Learn the methodology behind our scoring system.",
            to: "/credit-scores-info",
            icon: BarChart3,
            tone: "accent",
          },
        ],
      },
    ],
    feature: {
      eyebrow: "New",
      title: "Free credit monitoring",
      description: "Get alerts the moment your score changes — no card required.",
      to: "/crediq",
      cta: "Check my score",
      icon: Sparkles,
    },
  },
  {
    label: "Solutions",
    sections: [
      {
        heading: "Open Banking",
        items: [
          {
            title: "Account Information (AISP)",
            description: "Account data, balances and transactions.",
            to: "/guides/aisp",
            icon: Database,
            tone: "primary",
          },
          {
            title: "Payment Initiation (PISP)",
            description: "Initiate secure account-to-account payments.",
            to: "/guides/pisp",
            icon: Send,
            tone: "info",
          },
          {
            title: "Compliance & Security",
            description: "PSD2, GDPR and enterprise-grade controls.",
            to: "/guides/security",
            icon: Shield,
            tone: "accent",
          },
        ],
      },
      {
        heading: "Banking products",
        items: [
          {
            title: "Mobile Money",
            description: "MTN, Orange Money and other regional rails.",
            to: "/mobile-money",
            icon: Smartphone,
            tone: "warning",
          },
          {
            title: "Loans",
            description: "Automated lending with credit scoring built in.",
            to: "/loans",
            icon: DollarSign,
            tone: "success",
          },
          {
            title: "Savings",
            description: "High-yield savings with rate bonuses.",
            to: "/savings",
            icon: Wallet,
            tone: "primary",
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Featured",
      title: "Build with our APIs",
      description: "Production-ready endpoints for accounts, payments and KYC.",
      to: "/for-developers",
      cta: "Open the docs",
      icon: BookOpen,
    },
  },
  {
    label: "Resources",
    sections: [
      {
        heading: "Get started",
        items: [
          {
            title: "Payment Facilitation",
            description: "Accept payments instantly with one integration.",
            to: "/payment-facilitation",
            icon: CreditCard,
            tone: "primary",
          },
          {
            title: "Integration Workflow",
            description: "Step-by-step technical onboarding guide.",
            to: "/integration-workflow",
            icon: Lightbulb,
            tone: "warning",
          },
          {
            title: "Pricing & Fees",
            description: "Transparent, predictable pricing.",
            to: "/pricing",
            icon: DollarSign,
            tone: "success",
          },
        ],
      },
      {
        heading: "Help & status",
        items: [
          {
            title: "Developer API",
            description: "Quickstart, references and sandbox keys.",
            to: "/for-developers",
            icon: BookOpen,
            tone: "info",
          },
          {
            title: "API Status",
            description: "Real-time uptime and incident history.",
            to: "/status",
            icon: Activity,
            tone: "success",
            badge: "Live",
          },
          {
            title: "FAQ & Support",
            description: "Common questions and contact options.",
            to: "/faq",
            icon: HelpCircle,
            tone: "accent",
          },
        ],
      },
    ],
    feature: {
      eyebrow: "Plugin",
      title: "WooCommerce by Kang",
      description: "Drop-in checkout for any WooCommerce store.",
      to: "/woo-for-kang",
      cta: "Install the plugin",
      icon: Package,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mega-menu data hook — returns the static menu instantly today, but provides
// a single seam for future async sources (CMS, feature flags, A/B). When that
// happens, the loading state below will render the skeleton automatically.
// ─────────────────────────────────────────────────────────────────────────────

const useMegaMenuData = (): { menus: MegaMenu[]; isLoading: boolean } => {
  // Static for now → instant render, no flicker.
  return { menus: MEGA_MENUS, isLoading: false };
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — mirrors MegaPanel layout so the transition is imperceptible.
// Reused for both desktop dropdown and mobile accordion.
// ─────────────────────────────────────────────────────────────────────────────

const MegaPanelSkeleton = ({ withFeature = true }: { withFeature?: boolean }) => (
  <div
    className={cn(
      "grid gap-8 p-6 md:p-8 w-[760px] lg:w-[880px]",
      withFeature ? "grid-cols-[1fr_280px]" : "grid-cols-1",
    )}
    aria-busy="true"
    aria-live="polite"
  >
    <div className="grid grid-cols-2 gap-x-6 gap-y-6">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <ul className="space-y-1.5">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-start gap-3 p-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-11/12" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    {withFeature && (
      <div className="flex flex-col justify-between rounded-xl border bg-muted/30 p-5">
        <div className="space-y-3">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-11 w-11 rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <Skeleton className="mt-5 h-3.5 w-32" />
      </div>
    )}
  </div>
);

const MobileMegaSkeleton = () => (
  <div className="space-y-4 pl-1" aria-busy="true">
    {[0, 1].map((s) => (
      <div key={s} className="space-y-2">
        <Skeleton className="ml-2 h-3 w-20" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3 p-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5 pt-1">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Mega-menu panel — multi-column with optional feature card.
// ─────────────────────────────────────────────────────────────────────────────

const MegaPanel = ({ menu }: { menu: MegaMenu }) => {
  const hasFeature = !!menu.feature;
  return (
    <div
      className={cn(
        "grid gap-8 p-6 md:p-8 w-[760px] lg:w-[880px]",
        hasFeature ? "grid-cols-[1fr_280px]" : "grid-cols-1",
      )}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-6">
        {menu.sections.map((section) => (
          <div key={section.heading} className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.heading}
            </p>
            <ul className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const tone = TONE_RING[item.tone ?? "primary"];
                return (
                  <li key={item.to}>
                    <NavigationMenuLink asChild>
                      <Link
                        to={item.to}
                        className="group flex items-start gap-3 rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-accent/40 hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background transition-transform duration-200 group-hover:scale-105 group-hover:border-white/40 group-hover:bg-white group-hover:text-accent",
                            tone,
                          )}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-accent-foreground">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 group-hover:border-white/40 group-hover:bg-white/15 group-hover:text-accent-foreground dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 group-hover:bg-white" />
                                {item.badge}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground transition-colors group-hover:text-accent-foreground/85">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    </NavigationMenuLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {menu.feature && (
        <Link
          to={menu.feature.to}
          className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-muted/40 p-5 transition-all duration-200 hover:border-accent/40 hover:bg-accent hover:text-accent-foreground"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary group-hover:border-white/40 group-hover:bg-white/15 group-hover:text-accent-foreground">
              {menu.feature.eyebrow}
            </span>
            <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-background text-primary group-hover:border-white/40 group-hover:bg-white group-hover:text-accent">
              <menu.feature.icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h4 className="mt-4 text-base font-semibold text-foreground group-hover:text-accent-foreground">
              {menu.feature.title}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground group-hover:text-accent-foreground/85">
              {menu.feature.description}
            </p>
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:text-accent-foreground">
            {menu.feature.cta}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobile mega-menu — accordion sections with the same icon language.
// ─────────────────────────────────────────────────────────────────────────────

const MobileMegaItem = ({ item }: { item: MegaItem }) => {
  const Icon = item.icon;
  const tone = TONE_RING[item.tone ?? "primary"];
  return (
    <Link
      to={item.to}
      className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background",
          tone,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {item.title}
          </span>
          {item.badge && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {item.badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
          {item.description}
        </span>
      </span>
    </Link>
  );
};

export const Navigation = () => {
  const { t } = useLanguage();
  const { menus, isLoading } = useMegaMenuData();
  // Stable placeholder labels so the trigger row doesn't shift width while loading.
  const placeholderLabels = ["Credit Score", "Solutions", "Resources"];
  const desktopMenus = isLoading
    ? placeholderLabels.map((label) => ({ label, sections: [], feature: undefined } as MegaMenu))
    : menus;

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={kobLogo} alt="Kang Open Banking Logo" className="h-8 w-8" />
          <BrandName className="text-xl" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2">
          <NavigationMenu>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    to="/documentation"
                    className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    Documentation
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>

              {desktopMenus.map((menu) => (
                <NavigationMenuItem key={menu.label}>
                  <NavigationMenuTrigger
                    className="text-sm font-medium bg-transparent data-[state=open]:bg-muted hover:bg-muted"
                    aria-busy={isLoading || undefined}
                  >
                    {menu.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    {isLoading ? <MegaPanelSkeleton /> : <MegaPanel menu={menu} />}
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}

              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    to="/about"
                    className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    Company
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="ml-2 flex items-center gap-2">
            <LanguageSwitcher />
            <Link to="/auth">
              <Button variant="outline" size="sm">
                {t("signIn")}
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">{t("getStarted")}</Button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="outline" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[88vw] sm:w-96 p-0">
            <SheetHeader className="border-b px-5 py-4">
              <SheetTitle className="flex items-center gap-2">
                <img src={kobLogo} alt="" className="h-7 w-7" />
                <BrandName className="text-lg" />
              </SheetTitle>
            </SheetHeader>

            <div className="flex h-[calc(100vh-130px)] flex-col overflow-y-auto px-3 py-4">
              <Link
                to="/documentation"
                className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
              >
                Documentation
              </Link>

              <Accordion type="multiple" className="mt-1">
                {(isLoading ? placeholderLabels.map((l) => ({ label: l, sections: [], feature: undefined } as MegaMenu)) : menus).map((menu) => (
                  <AccordionItem
                    key={menu.label}
                    value={menu.label}
                    className="border-b-0"
                  >
                    <AccordionTrigger
                      className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted hover:no-underline"
                      aria-busy={isLoading || undefined}
                    >
                      {menu.label}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2">
                      {isLoading ? (
                        <MobileMegaSkeleton />
                      ) : (
                        <div className="space-y-4 pl-1">
                          {menu.sections.map((section) => (
                            <div key={section.heading}>
                              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {section.heading}
                              </p>
                              <div className="space-y-0.5">
                                {section.items.map((item) => (
                                  <MobileMegaItem key={item.to} item={item} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <Link
                to="/about"
                className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
              >
                Company
              </Link>

              <div className="mt-auto space-y-2 border-t pt-4">
                <div className="px-1">
                  <LanguageSwitcher />
                </div>
                <Link to="/auth" className="block">
                  <Button variant="outline" size="sm" className="w-full">
                    {t("signIn")}
                  </Button>
                </Link>
                <Link to="/register" className="block">
                  <Button size="sm" className="w-full">
                    {t("getStarted")}
                  </Button>
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};
