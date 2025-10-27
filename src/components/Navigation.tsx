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

export const Navigation = () => {
  const { t } = useLanguage();
  
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
              Guides <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/guides/aisp" className="cursor-pointer">Account Information (AISP)</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/guides/pisp" className="cursor-pointer">Payment Initiation (PISP)</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/guides/security" className="cursor-pointer">Security & Authentication</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/guides/webhooks" className="cursor-pointer">Webhooks & Events</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
              Portals <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/developer" className="cursor-pointer">Developer Portal</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard" className="cursor-pointer">My Dashboard</Link>
              </DropdownMenuItem>
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
          
          <Link to="/auth">
            <Button variant="outline" size="sm">{t('signIn')}</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">{t('getStarted')}</Button>
          </Link>
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
                <p className="text-xs font-semibold text-muted-foreground mb-3">GUIDES</p>
                <div className="space-y-3 ml-2">
                  <Link to="/guides/aisp" className="text-sm font-medium hover:text-primary transition-colors block">
                    Account Information (AISP)
                  </Link>
                  <Link to="/guides/pisp" className="text-sm font-medium hover:text-primary transition-colors block">
                    Payment Initiation (PISP)
                  </Link>
                  <Link to="/guides/security" className="text-sm font-medium hover:text-primary transition-colors block">
                    Security & Authentication
                  </Link>
                  <Link to="/guides/webhooks" className="text-sm font-medium hover:text-primary transition-colors block">
                    Webhooks & Events
                  </Link>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">PORTALS</p>
                <div className="space-y-3 ml-2">
                  <Link to="/developer" className="text-sm font-medium hover:text-primary transition-colors block">
                    Developer Portal
                  </Link>
                  <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors block">
                    My Dashboard
                  </Link>
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
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};
