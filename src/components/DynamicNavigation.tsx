import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const getPortalLinks = () => {
    const links = [];

    if (userStatus.isAuthenticated) {
      if (userStatus.institutionStatus === 'approved') {
        // Show appropriate portal based on institution type
        links.push(
          <DropdownMenuItem key="fi-portal" asChild>
            <Link to="/fi-portal" className="cursor-pointer">FI Portal</Link>
          </DropdownMenuItem>
        );
      } else if (userStatus.institutionStatus === 'pending' || userStatus.institutionStatus === 'rejected') {
        // Show application status
        links.push(
          <DropdownMenuItem key="status" asChild>
            <Link to="/pending-approval" className="cursor-pointer">
              📋 Application Status
            </Link>
          </DropdownMenuItem>
        );
      }
      
      // Show developer portal for developers
      if (userStatus.institutionType === 'developer' && userStatus.institutionStatus === 'approved') {
        links.push(
          <DropdownMenuItem key="dev" asChild>
            <Link to="/developer" className="cursor-pointer">Developer Portal</Link>
          </DropdownMenuItem>
        );
      }

      // Show dashboard
      links.push(
        <DropdownMenuItem key="dashboard" asChild>
          <Link to="/dashboard" className="cursor-pointer">My Dashboard</Link>
        </DropdownMenuItem>
      );
    }

    // Admin Portal - only for admins
    if (userStatus.isAdmin) {
      links.push(
        <DropdownMenuItem key="admin" asChild>
          <Link to="/admin" className="cursor-pointer">Admin Portal</Link>
        </DropdownMenuItem>
      );
    }

    // Banking Ops - only for authenticated users
    if (userStatus.isAuthenticated) {
      links.push(
        <DropdownMenuItem key="banking" asChild>
          <Link to="/banking-ops" className="cursor-pointer">Banking Ops</Link>
        </DropdownMenuItem>
      );
    }

    return links;
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
          
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
              Portals <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {getPortalLinks()}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
              Company <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/about" className="cursor-pointer">About</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/contact" className="cursor-pointer">Contact</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/faq" className="cursor-pointer">FAQ</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to="/status" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
            Status
          </Link>

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
                <p className="text-xs font-semibold text-muted-foreground mb-3">PORTALS</p>
                <div className="space-y-1 ml-2">
                  {getMobilePortalLinks()}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">COMPANY</p>
                <div className="space-y-3 ml-2">
                  <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors block">
                    About
                  </Link>
                  <Link to="/contact" className="text-sm font-medium hover:text-primary transition-colors block">
                    Contact
                  </Link>
                  <Link to="/faq" className="text-sm font-medium hover:text-primary transition-colors block">
                    FAQ
                  </Link>
                  <Link to="/status" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-2">
                    <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                    Status
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