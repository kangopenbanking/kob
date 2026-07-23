import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu, ChevronDown, Shield, BookOpen, Globe, BarChart3, Server, Code, LayoutDashboard, Landmark, Scale, FlaskConical, Activity, Smartphone, TrendingUp, Heart } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import kobLogo from "@/assets/kob-logo.png";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BrandName } from "./BrandName";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface UserStatus {
  isAuthenticated: boolean;
  hasInstitution: boolean;
  institutionStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  institutionType?: string;
  isAdmin: boolean;
  isDeveloper: boolean;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const platformItems: NavItem[] = [
  { label: "Apps Ecosystem", to: "/apps", icon: Smartphone, desc: "Multi-tenancy PWA showcase" },
  { label: "Architecture Overview", to: "/architecture", icon: Server, desc: "System design & infrastructure" },
  { label: "Fraud Engine", to: "/architecture/fraud-engine", icon: Shield, desc: "Multi-layer fraud prevention" },
  { label: "Ledger System", to: "/architecture/ledger-system", icon: BookOpen, desc: "Double-entry accounting" },
  { label: "Settlement Engine", to: "/architecture/settlement-engine", icon: Landmark, desc: "Automated payout processing" },
  { label: "Reconciliation", to: "/architecture/reconciliation-framework", icon: BarChart3, desc: "Three-way reconciliation" },
  { label: "Infrastructure", to: "/architecture/infrastructure", icon: Server, desc: "Multi-region redundancy" },
];

const complianceItems: NavItem[] = [
  { label: "Filing Pack", to: "/regulatory/filing-pack", icon: Scale, desc: "BEAC/COBAC regulatory filing documents" },
  { label: "Cameroon Compliance", to: "/regulatory/cameroon-compliance", icon: Scale, desc: "BEAC/COBAC regulatory framework" },
  { label: "AML Policy", to: "/compliance/aml-policy", icon: Shield, desc: "Anti-money laundering controls" },
  { label: "KYC Framework", to: "/compliance/kyc-framework", icon: Shield, desc: "Customer due diligence tiers" },
  { label: "Risk Monitoring", to: "/compliance/risk-monitoring", icon: Activity, desc: "Transaction surveillance" },
  { label: "Data Protection", to: "/data-protection", icon: Shield, desc: "GDPR & local data laws" },
];

const expansionItems: NavItem[] = [
  { label: "Cameroon", to: "/expansion/cameroon", icon: Globe, desc: "CEMAC primary market" },
  { label: "Nigeria", to: "/expansion/nigeria", icon: Globe, desc: "CBN regulated market" },
  { label: "Ghana", to: "/expansion/ghana", icon: Globe, desc: "BoG regulated market" },
  { label: "Kenya", to: "/expansion/kenya", icon: Globe, desc: "CBK regulated market" },
  { label: "South Africa", to: "/expansion/south-africa", icon: Globe, desc: "SARB regulated market" },
  { label: "Europe", to: "/expansion/europe", icon: Globe, desc: "PSD2 & EU expansion" },
];

const developerItems: NavItem[] = [
  { label: "Developer Portal", to: "/developer", icon: Code, desc: "Full API documentation" },
  { label: "API Explorer", to: "/developer/api-explorer", icon: Code, desc: "Interactive API reference" },
  { label: "Sandbox", to: "/developer/sandbox", icon: FlaskConical, desc: "Test environment" },
  { label: "SDKs & Libraries", to: "/developer/guides/sdks", icon: Code, desc: "Client libraries" },
  { label: "Webhooks", to: "/developer/api/webhooks", icon: Activity, desc: "Event notifications" },
  { label: "Changelog", to: "/developer/changelog", icon: BookOpen, desc: "Release history" },
];

const resourceItems: NavItem[] = [
  { label: "Money Remittance", to: "/remittance", icon: Globe, desc: "Send & receive internationally" },
  { label: "Giveting Fundraisers", to: "/giveting", icon: Heart, desc: "Start or donate to a cause" },
  { label: "Credit Score", to: "/crediq", icon: TrendingUp, desc: "Check your credit score" },
  { label: "Pricing & Fees", to: "/pricing", icon: Landmark, desc: "Transparent pricing" },
  { label: "Integration Guide", to: "/integration-workflow", icon: BookOpen, desc: "Step-by-step setup" },
  { label: "API Status", to: "/status", icon: Activity, desc: "Real-time system status" },
  { label: "FAQ", to: "/faq", icon: BookOpen, desc: "Common questions" },
  { label: "Contact", to: "/contact", icon: Globe, desc: "Get in touch" },
];

function NavMegaMenu({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="text-sm font-medium">{label}</NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="grid w-[500px] grid-cols-2 gap-2 p-4">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-primary hover:border-primary transition-colors"
            >
              <item.icon className="h-4 w-4 text-primary group-hover:text-white mt-0.5 shrink-0 transition-colors" />
              <div>
                <h3 className="text-sm font-semibold group-hover:text-white transition-colors">{item.label}</h3>
                <p className="text-xs text-muted-foreground group-hover:text-white transition-colors">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

function MobileSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="border-t pt-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3">{title.toUpperCase()}</p>
      <div className="space-y-3 ml-2">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="text-sm font-medium hover:text-primary transition-colors block">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export const DynamicNavigation = () => {
  const { t } = useLanguage();
  const [userStatus, setUserStatus] = useState<UserStatus>({
    isAuthenticated: false,
    hasInstitution: false,
    isAdmin: false,
    isDeveloper: false,
  });

  useEffect(() => {
    checkUserStatus();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUserStatus();
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  const checkUserStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserStatus({ isAuthenticated: false, hasInstitution: false, isAdmin: false, isDeveloper: false });
        return;
      }
      const { data: institution } = await supabase
        .from('institutions')
        .select('status, institution_type')
        .eq('user_id', user.id)
        .maybeSingle();
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setUserStatus({
        isAuthenticated: true,
        hasInstitution: !!institution,
        institutionStatus: institution?.status,
        institutionType: institution?.institution_type,
        isAdmin: !!isAdmin,
        isDeveloper: institution?.institution_type === 'developer',
      });
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };

  const getDashboardPath = () => {
    if (userStatus.isAdmin) return "/admin";
    if (userStatus.institutionStatus === 'approved') return userStatus.isDeveloper ? "/developer" : "/fi-portal";
    if (userStatus.hasInstitution) return "/pending-approval";
    return "/credit-score";
  };

  const getAuthButtons = () => {
    if (userStatus.isAuthenticated) {
      return (
        <>
          <Link to="/profile-settings"><Button variant="outline" size="sm">Profile</Button></Link>
          <Button size="sm" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}>Sign Out</Button>
        </>
      );
    }
    return (
      <>
        <Link to="/auth"><Button variant="outline" size="sm">{t('signIn')}</Button></Link>
        <Link to={userStatus.hasInstitution ? '/pending-approval' : '/register'}><Button size="sm">{t('getStarted')}</Button></Link>
      </>
    );
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={kobLogo} alt="Kang Open Banking Logo" className="h-8 w-8" />
          <BrandName className="text-xl" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-4">
          <Link to="/documentation" className="text-sm font-medium hover:text-primary transition-colors">API Docs</Link>

          <NavigationMenu>
            <NavigationMenuList>
              <NavMegaMenu label="Platform" items={platformItems} />
              <NavMegaMenu label="Compliance" items={complianceItems} />
              <NavMegaMenu label="Expansion" items={expansionItems} />
              <NavMegaMenu label="Developers" items={developerItems} />
              <NavMegaMenu label="Resources" items={resourceItems} />
              <NavigationMenuItem>
                <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors inline-flex items-center justify-center px-4 py-2">
                  Company
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <LanguageSwitcher />

          {userStatus.isAuthenticated && (
            <Link to={getDashboardPath()}>
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          )}

          {getAuthButtons()}
        </div>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="outline" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent className="w-80 overflow-y-auto">
            <div className="flex flex-col gap-4 mt-8">
              <Link to="/documentation" className="text-sm font-medium hover:text-primary transition-colors py-2">API Docs</Link>
              <MobileSection title="Platform" items={platformItems} />
              <MobileSection title="Compliance" items={complianceItems} />
              <MobileSection title="Expansion" items={expansionItems} />
              <MobileSection title="Developers" items={developerItems} />
              <MobileSection title="Resources" items={resourceItems} />

              {userStatus.isAuthenticated && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">PORTALS</p>
                  <div className="space-y-3 ml-2">
                    <Link to={getDashboardPath()} className="text-sm font-medium hover:text-primary transition-colors block">Dashboard</Link>
                    {userStatus.isAdmin && <Link to="/admin" className="text-sm font-medium hover:text-primary transition-colors block">Admin Portal</Link>}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors block py-2">Company</Link>
              </div>

              <div className="border-t pt-4 space-y-3">
                {getAuthButtons()}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};
