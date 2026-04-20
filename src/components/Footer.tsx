import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { BrandName } from "./BrandName";

const footerSections = [
  {
    title: "Company",
    ariaLabel: "Company information",
    links: [
      { label: "About Kang", to: "/about", title: "Learn about Kang Open Banking" },
      { label: "Help Centre", to: "/help-centre", title: "Guides, FAQs and Open Banking resources" },
      { label: "Live Chat", to: "#support-chat", title: "Chat with our support team" },
      { label: "Governance", to: "/compliance", title: "Corporate governance policies" },
      { label: "Regulatory", to: "/regulatory/cameroon-compliance", title: "COBAC & BEAC regulatory compliance" },
      { label: "Investor Relations", to: "/investors/technical-overview", title: "Technical overview for investors" },
      { label: "Contact", to: "/contact", title: "Contact Kang Open Banking" },
      { label: "FAQ", to: "/faq", title: "Frequently asked questions" },
    ],
  },
  {
    title: "Guides",
    ariaLabel: "Step-by-step guides",
    links: [
      { label: "First API Key in 2 mins", to: "/developer/guides/first-api-key", title: "From sign-up to working sandbox key" },
      { label: "Send Your First Charge", to: "/developer/guides/first-charge", title: "Take a test payment in 5 minutes" },
      { label: "Choosing a Payment Method", to: "/developer/guides/choosing-payment-method", title: "Pick the right channel for your customer" },
      { label: "Going Live (Simple)", to: "/developer/guides/going-live-simple", title: "Plain-English production checklist" },
      { label: "Quickstart", to: "/developer/quick-start", title: "Five-minute API quickstart" },
      { label: "Webhooks", to: "/guides/webhooks", title: "Real-time event notifications" },
      { label: "AISP — Account Info", to: "/guides/aisp", title: "Read account, balance and transaction data" },
      { label: "PISP — Payment Initiation", to: "/guides/pisp", title: "Initiate bank payments with SCA" },
      { label: "Idempotency", to: "/developer/guides/idempotency", title: "Safely retry payment operations" },
      { label: "Rate Limits", to: "/developer/guides/rate-limits", title: "Per-endpoint quotas and retry pattern" },
      { label: "mTLS Certificates", to: "/guides/certificates", title: "Mutual TLS for FAPI 1.0 Advanced" },
      { label: "API Security", to: "/guides/security", title: "OAuth, mTLS and hardening checklist" },
    ],
  },
  {
    title: "Manuals",
    ariaLabel: "End-user manuals",
    links: [
      { label: "Customer Guide", to: "/manual/customers", title: "User guide for customers" },
      { label: "Merchant Guide", to: "/manual/merchants", title: "Integration guide for merchants" },
      { label: "Bank Manual", to: "/manual/banks", title: "Integration manual for banks" },
      { label: "Developer Manual", to: "/manual/developers", title: "Technical manual for developers" },
      { label: "Bank Integration Guide", to: "/bank-integration-guide", title: "Technical guide for bank API integration" },
    ],
  },
  {
    title: "Products",
    ariaLabel: "Product offerings",
    links: [
      { label: "KOB POS", to: "/kob-pos", title: "Point of sale terminal system" },
      { label: "Storefront", to: "/merchant/storefront", title: "Online storefront for merchants" },
      { label: "Money Remittance", to: "/remittance", title: "Send and receive money internationally" },
      { label: "Piggy Bank", to: "/piggybank", title: "Personal savings and rent plans" },
      { label: "Njangi (Money Pot)", to: "/njangi", title: "Group savings and rotating money pot" },
      { label: "Rent Reporting", to: "/rent-reporting", title: "Build credit through rent payments" },
      { label: "CrediQ Credit Score", to: "/crediq", title: "AI-powered credit scoring system" },
      { label: "Credit Scores Info", to: "/credit-scores-info", title: "How credit scores work in Cameroon" },
      { label: "BYO Mobile Money", to: "/products/byo-mobile-money", title: "Bring your own MTN MoMo or Orange Money credentials" },
    ],
  },
  {
    title: "Developers",
    ariaLabel: "Developer resources",
    links: [
      { label: "API Reference", to: "/documentation", title: "Complete API documentation" },
      { label: "Developer Portal", to: "/developer", title: "Developer tools and resources" },
      { label: "SDKs & Libraries", to: "/developer/guides/sdks", title: "Software development kits and libraries" },
      { label: "Webhooks", to: "/developer/api/webhooks", title: "Webhook event notifications" },
      { label: "Sandbox", to: "/developer/sandbox", title: "API testing sandbox environment" },
      { label: "Changelog", to: "/developer/changelog", title: "API version changelog" },
      { label: "API Explorer", to: "/developer/api-explorer", title: "Interactive API explorer tool" },
      { label: "Zapier", to: "/integrations/zapier", title: "Zapier no-code integration guide" },
      { label: "Make.com", to: "/integrations/make", title: "Make.com automation integration guide" },
      { label: "Bubble.io", to: "/integrations/bubble", title: "Bubble.io no-code app builder guide" },
      { label: "Retool", to: "/integrations/retool", title: "Retool internal tools integration guide" },
    ],
  },
  {
    title: "Compliance",
    ariaLabel: "Compliance and regulatory policies",
    links: [
      { label: "AML Policy", to: "/compliance/aml-policy", title: "Anti-money laundering policy" },
      { label: "KYC Framework", to: "/compliance/kyc-framework", title: "Know your customer verification framework" },
      { label: "Data Protection", to: "/data-protection", title: "Data protection and privacy policy" },
      { label: "Risk Monitoring", to: "/compliance/risk-monitoring", title: "Transaction risk monitoring system" },
      { label: "PCI Scope", to: "/security-policy", title: "PCI-DSS compliance scope and security policy" },
      { label: "Open Banking Standards", to: "/compliance", title: "Open banking compliance standards" },
    ],
  },
  {
    title: "Infrastructure",
    ariaLabel: "Technical infrastructure",
    links: [
      { label: "Architecture", to: "/architecture", title: "System architecture overview" },
      { label: "Ledger System", to: "/architecture/ledger-system", title: "Double-entry ledger system" },
      { label: "Fraud Engine", to: "/architecture/fraud-engine", title: "Real-time fraud detection engine" },
      { label: "Settlement Engine", to: "/architecture/settlement-engine", title: "Payment settlement processing" },
      { label: "Reconciliation", to: "/architecture/reconciliation-framework", title: "Transaction reconciliation framework" },
      { label: "Disaster Recovery", to: "/architecture/disaster-recovery", title: "Disaster recovery and business continuity" },
    ],
  },
  {
    title: "Expansion",
    ariaLabel: "Market expansion regions",
    links: [
      { label: "Cameroon", to: "/expansion/cameroon", title: "Kang Open Banking in Cameroon" },
      { label: "Nigeria", to: "/expansion/nigeria", title: "Kang Open Banking in Nigeria" },
      { label: "Ghana", to: "/expansion/ghana", title: "Kang Open Banking in Ghana" },
      { label: "Kenya", to: "/expansion/kenya", title: "Kang Open Banking in Kenya" },
      { label: "South Africa", to: "/expansion/south-africa", title: "Kang Open Banking in South Africa" },
      { label: "Europe", to: "/expansion/europe", title: "Kang Open Banking in Europe" },
    ],
  },
  {
    title: "Legal",
    ariaLabel: "Legal documents and policies",
    links: [
      { label: "Terms of Service", to: "/terms", title: "Terms of service agreement" },
      { label: "Privacy Policy", to: "/privacy", title: "Privacy and data handling policy" },
      { label: "Cookie Policy", to: "/cookies", title: "Cookie usage and consent policy" },
      { label: "Acceptable Use", to: "/aup", title: "Acceptable use policy" },
      { label: "Security", to: "/security-policy", title: "Security policy and certifications" },
      { label: "SLA", to: "/sla", title: "Service level agreement and uptime guarantees" },
      { label: "Dispute Policy", to: "/developer/gateway/disputes", title: "Payment dispute resolution policy" },
    ],
  },
];

export const Footer = () => {
  return (
    <footer className="border-t py-12 bg-card" aria-label="Site footer">
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
            <nav key={section.title} aria-label={section.ariaLabel}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {section.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      title={link.title}
                      className="hover:text-primary transition-colors inline-flex items-center min-h-[44px] py-1.5"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Large brand text like "Flow" in reference */}
        <div className="mt-12 overflow-hidden select-none text-center" aria-hidden="true">
          <p className="text-[clamp(4rem,15vw,16rem)] font-black leading-none tracking-[0.3em] text-primary whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
            K A N G
          </p>
        </div>

        <div className="border-t mt-8 pt-8 space-y-4 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2026 Kang <span style={{ color: '#9fe870' }}>Open</span> Banking. All rights reserved.</p>
            <div className="flex gap-2 flex-wrap">
              <Link to="/status" title="System status and uptime" className="hover:text-primary transition-colors inline-flex items-center min-h-[44px] px-2 py-1.5">Status</Link>
              <Link to="/security-policy" title="Security policy and certifications" className="hover:text-primary transition-colors inline-flex items-center min-h-[44px] px-2 py-1.5">Security</Link>
              <Link to="/compliance" title="Open banking compliance standards" className="hover:text-primary transition-colors inline-flex items-center min-h-[44px] px-2 py-1.5">Compliance</Link>
              <Link to="/certification/a-grade-status" title="A-Grade certification status" className="hover:text-primary transition-colors inline-flex items-center min-h-[44px] px-2 py-1.5">A-Grade Certification</Link>
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
