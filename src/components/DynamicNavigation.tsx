import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu, ChevronDown, Database, Send, Smartphone, Shield, FileText, DollarSign, Activity, HelpCircle, MessageCircle, BookOpen, Lightbulb, TrendingUp, Target, BarChart3, Puzzle, Code } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import kobLogo from "@/assets/kob-logo.png";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BrandName } from "./BrandName";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface UserStatus {
  isAuthenticated: boolean;
  hasInstitution: boolean;
  institutionStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  institutionType?: string;
  isAdmin: boolean;
}

export const DynamicNavigation = () => {
  const { t } = useLanguage();
  const [userStatus, setUserStatus] = useState<UserStatus>({
    isAuthenticated: false,
    hasInstitution: false,
    isAdmin: false
  });

  useEffect(() => {
    checkUserStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUserStatus();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUserStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUserStatus({ isAuthenticated: false, hasInstitution: false, isAdmin: false });
        return;
      }

      const { data: institution } = await supabase
        .from('institutions')
        .select('status, institution_type')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      setUserStatus({
        isAuthenticated: true,
        hasInstitution: !!institution,
        institutionStatus: institution?.status,
        institutionType: institution?.institution_type,
        isAdmin: !!isAdmin
      });
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  };

  const getMobilePortalLinks = () => {
    const links = [];

    if (userStatus.isAuthenticated) {
      if (userStatus.institutionStatus === 'approved') {
        links.push(
          <Link key="fi-portal" to="/fi-portal" className="text-sm font-medium hover:text-primary transition-colors block py-2">
            FI Portal
          </Link>
        );
      } else if (userStatus.institutionStatus === 'pending' || userStatus.institutionStatus === 'rejected') {
        links.push(
          <Link key="status" to="/pending-approval" className="text-sm font-medium hover:text-primary transition-colors block py-2">
            📋 Application Status
          </Link>
        );
      }
      
      if (userStatus.institutionType === 'developer' && userStatus.institutionStatus === 'approved') {
        links.push(
          <Link key="dev" to="/developer" className="text-sm font-medium hover:text-primary transition-colors block py-2">
            Developer Portal
          </Link>
        );
      }

      links.push(
        <Link key="dashboard" to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors block py-2">
          My Dashboard
        </Link>
      );
    }

    // Admin Portal - only for admins
    if (userStatus.isAdmin) {
      links.push(
        <Link key="admin" to="/admin" className="text-sm font-medium hover:text-primary transition-colors block py-2">
          Admin Portal
        </Link>
      );
    }

    // Banking Ops - only for authenticated users
    if (userStatus.isAuthenticated) {
      links.push(
        <Link key="banking" to="/banking-ops" className="text-sm font-medium hover:text-primary transition-colors block py-2">
          Banking Ops
        </Link>
      );
    }

    return links;
  };

  const getAuthButtons = () => {
    if (userStatus.isAuthenticated) {
      return (
        <>
          <Link to="/profile-settings">
            <Button variant="outline" size="sm">Profile</Button>
          </Link>
          <Button 
            size="sm" 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
          >
            Sign Out
          </Button>
        </>
      );
    }

    return (
      <>
        <Link to="/auth">
          <Button variant="outline" size="sm">{t('signIn')}</Button>
        </Link>
        <Link to={userStatus.hasInstitution ? '/pending-approval' : '/register'}>
          <Button size="sm">{t('getStarted')}</Button>
        </Link>
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
        <div className="hidden lg:flex items-center gap-6">
          <Link to="/documentation" className="text-sm font-medium hover:text-primary transition-colors">
            Documentation
          </Link>
          
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-medium">
                  Credit Score
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[600px] gap-3 p-6">
                    <Link 
                      to="/credit-score" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          My Credit Score
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          View your current credit score and trends
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/credit-report" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Credit Report
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Access your detailed credit history
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/crediq/dashboard" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          CrediQ Dashboard
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Track goals and improvement plans
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/credit-scores-info" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <BarChart3 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          How Credit Scores Work
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Learn about our credit scoring system
                        </p>
                      </div>
                    </Link>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-medium">
                  Solutions
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[600px] gap-3 p-6">
                    <Link 
                      to="/guides/aisp" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <Database className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Account Information (AISP)
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Access account data, balances, and transactions securely
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/guides/pisp" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <Send className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Payment Initiation (PISP)
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Enable secure payment initiation and transfers
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/mobile-money" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Mobile Money
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Integrate with MTN, Orange Money and other providers
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/guides/security" 
                      className="group grid grid-cols-[48px_1fr] gap-4 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background">
                        <Shield className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Compliance & Security
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          PSD2, GDPR compliant with enterprise-grade security
                        </p>
                      </div>
                    </Link>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-medium">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[600px] grid-cols-2 gap-3 p-6">
                    <Link 
                      to="/integration-workflow" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Integration Workflow
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Step-by-step integration guide
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/pricing" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Pricing & Fees
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Transparent pricing structure
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/developer" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Developer Portal
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          API docs and testing tools
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/status" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <Activity className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          API Status
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Real-time system status
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/faq" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <HelpCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          FAQ
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Common questions answered
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/contact" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Support
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Get help from our team
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/integrations" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <Puzzle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          No-Code Integrations
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Zapier, Make, Bubble & Retool guides
                        </p>
                      </div>
                    </Link>
                    
                    <Link 
                      to="/embed-status-widget" 
                      className="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
                    >
                      <Code className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Embeddable Widget
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Add status to your site
                        </p>
                      </div>
                    </Link>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors inline-flex items-center justify-center px-4 py-2">
                  Company
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <LanguageSwitcher />
          
          {getAuthButtons()}
        </div>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-80">
            <div className="flex flex-col gap-4 mt-8">
              <Link to="/documentation" className="text-sm font-medium hover:text-primary transition-colors py-2">
                Documentation
              </Link>
              
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">CREDIT SCORE</p>
                <div className="space-y-3 ml-2">
                  <Link to="/credit-score" className="text-sm font-medium hover:text-primary transition-colors block">
                    My Credit Score
                  </Link>
                  <Link to="/credit-report" className="text-sm font-medium hover:text-primary transition-colors block">
                    Credit Report
                  </Link>
                  <Link to="/crediq/dashboard" className="text-sm font-medium hover:text-primary transition-colors block">
                    CrediQ Dashboard
                  </Link>
                  <Link to="/credit-scores-info" className="text-sm font-medium hover:text-primary transition-colors block">
                    How Credit Scores Work
                  </Link>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">SOLUTIONS</p>
                <div className="space-y-3 ml-2">
                  <Link to="/guides/aisp" className="text-sm font-medium hover:text-primary transition-colors block">
                    Account Information (AISP)
                  </Link>
                  <Link to="/guides/pisp" className="text-sm font-medium hover:text-primary transition-colors block">
                    Payment Initiation (PISP)
                  </Link>
                  <Link to="/mobile-money" className="text-sm font-medium hover:text-primary transition-colors block">
                    Mobile Money
                  </Link>
                  <Link to="/guides/security" className="text-sm font-medium hover:text-primary transition-colors block">
                    Compliance & Security
                  </Link>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">PORTALS (AUTHENTICATED)</p>
                <div className="space-y-1 ml-2">
                  {getMobilePortalLinks()}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">RESOURCES</p>
                <div className="space-y-3 ml-2">
                  <Link to="/integration-workflow" className="text-sm font-medium hover:text-primary transition-colors block">
                    Integration Workflow
                  </Link>
                  <Link to="/pricing" className="text-sm font-medium hover:text-primary transition-colors block">
                    Pricing & Fees
                  </Link>
                  <Link to="/status" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-2">
                    <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                    API Status
                  </Link>
                  <Link to="/integrations" className="text-sm font-medium hover:text-primary transition-colors block">
                    No-Code Integrations
                  </Link>
                  <Link to="/embed-status-widget" className="text-sm font-medium hover:text-primary transition-colors block">
                    Embeddable Widget
                  </Link>
                  <Link to="/faq" className="text-sm font-medium hover:text-primary transition-colors block">
                    FAQ
                  </Link>
                  <Link to="/contact" className="text-sm font-medium hover:text-primary transition-colors block">
                    Support
                  </Link>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">COMPANY</p>
                <div className="space-y-3 ml-2">
                  <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors block">
                    About Us
                  </Link>
                  <Link to="/contact" className="text-sm font-medium hover:text-primary transition-colors block">
                    Contact Sales
                  </Link>
                </div>
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