import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { BrandName } from "./BrandName";

const footerSections = [
  {
    title: "Company",
    links: [
      { label: "About Kang", to: "/about" },
      { label: "Governance", to: "/compliance" },
      { label: "Regulatory", to: "/regulatory/cameroon-compliance" },
      { label: "Investor Relations", to: "/investors/technical-overview" },
      { label: "Contact", to: "/contact" },
      { label: "FAQ", to: "/faq" },
      { label: "Bank Manual", to: "/manual/banks" },
      { label: "Customer Guide", to: "/manual/customers" },
      { label: "Developer Manual", to: "/manual/developers" },
    ],
  },
  {
    title: "Products",
    links: [
      { label: "Piggy Bank", to: "/piggybank" },
      { label: "Njangi (Money Pot)", to: "/njangi" },
      { label: "Rent Reporting", to: "/rent-reporting" },
      { label: "CrediQ Credit Score", to: "/crediq" },
      { label: "Credit Scores Info", to: "/credit-scores-info" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API Reference", to: "/documentation" },
      { label: "Developer Portal", to: "/developer" },
      { label: "SDKs & Libraries", to: "/developer/guides/sdks" },
      { label: "Webhooks", to: "/developer/api/webhooks" },
      { label: "Sandbox", to: "/developer/sandbox" },
      { label: "Changelog", to: "/developer/changelog" },
      { label: "API Explorer", to: "/developer/api-explorer" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { label: "AML Policy", to: "/compliance/aml-policy" },
      { label: "KYC Framework", to: "/compliance/kyc-framework" },
      { label: "Data Protection", to: "/data-protection" },
      { label: "Risk Monitoring", to: "/compliance/risk-monitoring" },
      { label: "PCI Scope", to: "/security-policy" },
      { label: "Open Banking Standards", to: "/compliance" },
    ],
  },
  {
    title: "Infrastructure",
    links: [
      { label: "Architecture", to: "/architecture" },
      { label: "Ledger System", to: "/architecture/ledger-system" },
      { label: "Fraud Engine", to: "/architecture/fraud-engine" },
      { label: "Settlement Engine", to: "/architecture/settlement-engine" },
      { label: "Reconciliation", to: "/architecture/reconciliation-framework" },
      { label: "Disaster Recovery", to: "/architecture/disaster-recovery" },
    ],
  },
  {
    title: "Expansion",
    links: [
      { label: "Cameroon", to: "/expansion/cameroon" },
      { label: "Nigeria", to: "/expansion/nigeria" },
      { label: "Ghana", to: "/expansion/ghana" },
      { label: "Kenya", to: "/expansion/kenya" },
      { label: "South Africa", to: "/expansion/south-africa" },
      { label: "Europe", to: "/expansion/europe" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Acceptable Use", to: "/aup" },
      { label: "Security", to: "/security-policy" },
      { label: "SLA", to: "/sla" },
      { label: "Dispute Policy", to: "/developer/gateway/disputes" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="border-t py-12 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-8 gap-8">
          <div className="col-span-2 md:col-span-1">
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

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="hover:text-primary transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t mt-8 pt-8 space-y-4 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2026 Kang <span style={{ color: '#9fe870' }}>Open</span> Banking. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/status" className="hover:text-primary transition-colors">Status</Link>
              <Link to="/security-policy" className="hover:text-primary transition-colors">Security</Link>
              <Link to="/compliance" className="hover:text-primary transition-colors">Compliance</Link>
              <Link to="/certification/a-grade-status" className="hover:text-primary transition-colors">A-Grade Certification</Link>
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
