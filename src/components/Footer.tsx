import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t py-12 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Kang Open Banking</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Unified banking API for Cameroon's financial ecosystem
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/documentation" className="hover:text-primary">Documentation</Link></li>
              <li><Link to="/developer" className="hover:text-primary">API Reference</Link></li>
              <li><a href="#" className="hover:text-primary">Sandbox</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary">About</a></li>
              <li><a href="#" className="hover:text-primary">Contact</a></li>
              <li><a href="#" className="hover:text-primary">Support</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary">Privacy</a></li>
              <li><a href="#" className="hover:text-primary">Terms</a></li>
              <li><a href="#" className="hover:text-primary">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          © 2025 Kang Open Banking. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
