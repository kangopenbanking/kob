import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { BrandName } from "./BrandName";

export const Footer = () => {
  return (
    <footer className="border-t py-12 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-6 w-6 text-primary" />
              <BrandName className="text-lg" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Unified banking API for Cameroon's financial ecosystem
            </p>
            <p className="text-xs text-muted-foreground">
              COBAC & BEAC Compliant | PCI-DSS Certified
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/documentation" className="hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link to="/developer" className="hover:text-primary transition-colors">API Reference</Link></li>
              <li><Link to="/developer" className="hover:text-primary transition-colors">Sandbox</Link></li>
              <li><Link to="/status" className="hover:text-primary transition-colors">Status</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Developers</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/documentation" className="hover:text-primary transition-colors">Get Started</Link></li>
              <li><Link to="/developer" className="hover:text-primary transition-colors">Developer Portal</Link></li>
              <li><Link to="/developer" className="hover:text-primary transition-colors">SDKs</Link></li>
              <li><Link to="/developer" className="hover:text-primary transition-colors">Webhooks</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
              <li><Link to="/status" className="hover:text-primary transition-colors">System Status</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link></li>
              <li><Link to="/security-policy" className="hover:text-primary transition-colors">Security</Link></li>
              <li><Link to="/compliance" className="hover:text-primary transition-colors">Compliance</Link></li>
              <li><Link to="/sla" className="hover:text-primary transition-colors">SLA</Link></li>
              <li><Link to="/aup" className="hover:text-primary transition-colors">Acceptable Use</Link></li>
              <li><Link to="/data-protection" className="hover:text-primary transition-colors">Data Protection</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 Kang <span style={{ color: '#9fe870' }}>Open</span> Banking. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/status" className="hover:text-primary transition-colors">Status</Link>
            <Link to="/security-policy" className="hover:text-primary transition-colors">Security</Link>
            <Link to="/compliance" className="hover:text-primary transition-colors">Compliance</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
