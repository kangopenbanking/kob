import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { BrandName } from "./BrandName";

export const Footer = () => {
  return (
    <footer className="border-t py-12 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-8">
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
              <li><Link to="/integration-workflow" className="hover:text-primary transition-colors">Integration Guide</Link></li>
              <li><Link to="/pricing" className="hover:text-primary transition-colors">Pricing & Fees</Link></li>
              <li><Link to="/documentation" className="hover:text-primary transition-colors">Documentation</Link></li>
              <li><Link to="/guides/aisp" className="hover:text-primary transition-colors">AISP Guide</Link></li>
              <li><Link to="/guides/pisp" className="hover:text-primary transition-colors">PISP Guide</Link></li>
              <li><Link to="/status" className="hover:text-primary transition-colors">Status</Link></li>
              <li><Link to="/status-widget" className="hover:text-primary transition-colors">Status Widget</Link></li>
              <li><Link to="/embed-status-widget" className="hover:text-primary transition-colors">Embed Widget</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/crediq" className="hover:text-primary transition-colors">CrediQ Credit Score</Link></li>
              <li><Link to="/loans" className="hover:text-primary transition-colors">Loans</Link></li>
              <li><Link to="/savings" className="hover:text-primary transition-colors">Savings</Link></li>
              <li><Link to="/credit-score" className="hover:text-primary transition-colors">Credit Reports</Link></li>
              <li><Link to="/virtual-cards" className="hover:text-primary transition-colors">Virtual Cards</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Developers</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/developer" className="hover:text-primary transition-colors">Developer Portal</Link></li>
              <li><Link to="/developer/getting-started" className="hover:text-primary transition-colors">Get Started</Link></li>
              <li><Link to="/developer/api/aisp" className="hover:text-primary transition-colors">AISP APIs</Link></li>
              <li><Link to="/developer/api/pisp" className="hover:text-primary transition-colors">PISP APIs</Link></li>
              <li><Link to="/developer/api/mobile-money" className="hover:text-primary transition-colors">Mobile Money</Link></li>
              <li><Link to="/developer/console" className="hover:text-primary transition-colors">API Console</Link></li>
              <li><Link to="/integrations" className="hover:text-primary transition-colors">No-Code Integrations</Link></li>
              <li><Link to="/integrations/zapier" className="hover:text-primary transition-colors">Zapier Integration</Link></li>
              <li><Link to="/integrations/make" className="hover:text-primary transition-colors">Make Integration</Link></li>
              <li><Link to="/integrations/bubble" className="hover:text-primary transition-colors">Bubble Integration</Link></li>
              <li><Link to="/integrations/retool" className="hover:text-primary transition-colors">Retool Integration</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
              <li><Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/security-policy" className="hover:text-primary transition-colors">Security</Link></li>
              <li><Link to="/compliance" className="hover:text-primary transition-colors">Compliance</Link></li>
              <li><Link to="/sla" className="hover:text-primary transition-colors">SLA</Link></li>
              <li><Link to="/data-protection" className="hover:text-primary transition-colors">Data Protection</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 space-y-4 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2025 Kang <span style={{ color: '#9fe870' }}>Open</span> Banking. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/status" className="hover:text-primary transition-colors">Status</Link>
              <Link to="/security-policy" className="hover:text-primary transition-colors">Security</Link>
              <Link to="/compliance" className="hover:text-primary transition-colors">Compliance</Link>
            </div>
          </div>
          
          <div className="border-t pt-4 text-xs text-muted-foreground/80 leading-relaxed">
            <p className="mb-2">
              Kang Open Banking (KOB) is a product of <span className="font-medium">Kang Consultancy Co Ltd</span>, registered under the Canada Business Corporations Act (CBCA) (s. 19 and 106) (Reg. No. 1381210-3) with offices in Port Dover, ON, Canada.
            </p>
            <p>
              In Cameroon, it is registered under Reg. No. RCBDA2021B000451, regulated by the Ministry of Small and Medium-Sized Enterprises, and accredited by the Management Centre (CGA/AMC) (Tax Reg. M102116572371B).
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
