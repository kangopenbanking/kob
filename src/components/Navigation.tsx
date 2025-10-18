import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Building2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Navigation = () => {
  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-primary">Kang Open Banking</span>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/documentation" className="text-sm font-medium hover:text-primary transition-colors">
            Documentation
          </Link>
          <Link to="/register" className="text-sm font-medium hover:text-primary transition-colors">
            Register
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
          <Link to="/admin">
            <Button variant="outline" size="sm">Admin Portal</Button>
          </Link>
          <Link to="/developer">
            <Button size="sm" className="bg-gradient-to-r from-primary to-primary-light">
              Developer Portal
            </Button>
          </Link>
        </div>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <div className="flex flex-col gap-4 mt-8">
              <Link to="/documentation" className="text-sm font-medium hover:text-primary transition-colors">
                Documentation
              </Link>
              <Link to="/register" className="text-sm font-medium hover:text-primary transition-colors">
                Register
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="sm" className="w-full">Sign In</Button>
              </Link>
              <Link to="/admin">
                <Button variant="outline" size="sm" className="w-full">Admin Portal</Button>
              </Link>
              <Link to="/developer">
                <Button size="sm" className="w-full bg-gradient-to-r from-primary to-primary-light">
                  Developer Portal
                </Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};
