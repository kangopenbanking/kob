import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Building2, Menu, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navigation = () => {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold">Kang Open Banking</span>
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
              <DropdownMenuItem asChild>
                <Link to="/developer" className="cursor-pointer">Developer Portal</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin" className="cursor-pointer">Admin Portal</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/banking-ops" className="cursor-pointer">Banking Ops</Link>
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
          
          <Link to="/auth">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get Started</Button>
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
                <p className="text-xs font-semibold text-muted-foreground mb-3">PORTALS</p>
                <div className="space-y-3 ml-2">
                  <Link to="/developer" className="text-sm font-medium hover:text-primary transition-colors block">
                    Developer Portal
                  </Link>
                  <Link to="/admin" className="text-sm font-medium hover:text-primary transition-colors block">
                    Admin Portal
                  </Link>
                  <Link to="/banking-ops" className="text-sm font-medium hover:text-primary transition-colors block">
                    Banking Ops
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
