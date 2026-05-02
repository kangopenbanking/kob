import { Helmet } from "react-helmet-async";
import { HeroSection } from "@/components/developer/landing/HeroSection";
import { IntegrationOverview } from "@/components/developer/landing/IntegrationOverview";
import { UseCasesSection } from "@/components/developer/landing/UseCasesSection";
import { SecuritySection } from "@/components/developer/landing/SecuritySection";
import { CodeSnippetSection } from "@/components/developer/landing/CodeSnippetSection";
import { SDKSection } from "@/components/developer/landing/SDKSection";
import { OpenBankingSection } from "@/components/developer/landing/OpenBankingSection";
import { ArchitectureSection } from "@/components/developer/landing/ArchitectureSection";
import { AdvancedFeaturesGate } from "@/components/developer/landing/AdvancedFeaturesGate";
import { StandardsComplianceRow } from "@/components/developer/landing/StandardsComplianceRow";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { InstantKeyGenerator } from "@/components/developer/InstantKeyGenerator";
import { OnboardingWizard } from "@/components/developer/OnboardingWizard";
import { TryItNowPlayground } from "@/components/developer/TryItNowPlayground";

const jsonLdWebAPI = {
  "@context": "https://schema.org",
  "@type": "WebAPI",
  "name": "Kang Open Banking API",
  "description": "Payment Gateway and Open Banking REST API for Cameroon and the CEMAC region. Accept mobile money (MTN MoMo, Orange Money), card payments, bank transfers, and initiate payouts — all through a single unified API.",
  "url": "https://kangopenbanking.com/developer",
  "documentation": "https://kangopenbanking.com/developer/getting-started",
  "termsOfService": "https://kangopenbanking.com/terms",
  "provider": {
    "@type": "Organization",
    "name": "Kang Open Banking",
    "url": "https://kangopenbanking.com"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "XAF",
    "description": "Free sandbox access with 1,000 test requests per day"
  },
  "category": "Payment Gateway, Open Banking, Financial Services API",
  "applicationCategory": "FinanceTechnology",
  "operatingSystem": "Platform Independent",
  "softwareVersion": "1.0",
  "featureList": [
    "Mobile Money Payments (MTN MoMo, Orange Money)",
    "Card Payments (Visa, Mastercard, 3D-Secure)",
    "Bank-to-Bank Transfers (P2P, P2B, B2B)",
    "Payment Initiation Service (PISP)",
    "Account Information Service (AISP)",
    "Instant Payouts (Visa Direct, Mastercard Send)",
    "Custodial Wallets & Escrow",
    "Split Payments & Marketplace Settlements",
    "Recurring Billing & Subscriptions",
    "Credit Scoring API",
    "Compliance Screening (AML/KYC)",
    "Webhooks & Real-time Events",
    "ISO 20022 & SWIFT Messaging",
    "XAF-Native Multi-Currency Support"
  ]
};

const jsonLdBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://kangopenbanking.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Developer Portal",
      "item": "https://kangopenbanking.com/developer"
    }
  ]
};

const jsonLdFAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What payment methods does the Kang Open Banking API support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The API supports mobile money (MTN MoMo, Orange Money, Express Union), card payments (Visa, Mastercard with 3D-Secure), bank transfers, USSD, Apple Pay, Google Pay, and PayPal."
      }
    },
    {
      "@type": "Question",
      "name": "Is the API free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, sandbox access is completely free with 1,000 test requests per day. No credit card required to get started."
      }
    },
    {
      "@type": "Question",
      "name": "Which countries and currencies are supported?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The API natively supports XAF (Central African CFA franc) and covers Cameroon and the CEMAC region (Gabon, Congo, Chad, CAR, Equatorial Guinea)."
      }
    }
  ]
};

export default function DeveloperHome() {
  return (
    <>
      <Helmet>
        <title>Payment Gateway & Open Banking API for Africa | Kang Open Banking</title>
        <meta name="description" content="Accept mobile money, cards, and bank transfers in Cameroon & CEMAC. Unified REST API for AISP, PISP, payouts, wallets, and credit scoring. Free sandbox." />
        <link rel="canonical" href="https://kangopenbanking.com/developer" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kangopenbanking.com/developer" />
        <meta property="og:title" content="Payment Gateway & Open Banking API for Africa | Kang Open Banking" />
        <meta property="og:description" content="Accept mobile money, cards, and bank transfers in Cameroon & CEMAC. Unified REST API for payments, open banking, and financial services." />
        <meta property="og:site_name" content="Kang Open Banking" />
        <meta property="og:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/JCSxavmYvgdqHjrgJueCfjq5jxn2/social-images/social-1760797042805-Screenshot 2025-10-18 at 15.16.08.png" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Payment Gateway & Open Banking API for Africa" />
        <meta name="twitter:description" content="Unified REST API for mobile money, card payments, bank transfers, payouts, and open banking in Cameroon & CEMAC." />
        <meta name="twitter:image" content="https://storage.googleapis.com/gpt-engineer-file-uploads/JCSxavmYvgdqHjrgJueCfjq5jxn2/social-images/social-1760797042805-Screenshot 2025-10-18 at 15.16.08.png" />

        {/* Structured Data */}
        <script type="application/ld+json">{JSON.stringify(jsonLdWebAPI)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLdBreadcrumb)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLdFAQ)}</script>
      </Helmet>

      <div className="space-y-16 pb-8">
        <HeroSection />

        {/* Auditor 10-second test: visible standards compliance row */}
        <StandardsComplianceRow />

        {/* Instant sandbox credentials -- public, no auth */}
        <section id="instant-keys" aria-label="Instant API Key Generation">
          <InstantKeyGenerator />
        </section>

        {/* Step-by-step onboarding wizard */}
        <section id="onboarding" aria-label="Step-by-step Integration Guide">
          <OnboardingWizard />
        </section>

        {/* Try It Now playground -- public, no auth */}
        <section id="try-it-now" aria-label="Interactive API Playground">
          <TryItNowPlayground />
        </section>

        <IntegrationOverview />
        <UseCasesSection />
        <CodeSnippetSection />
        <SecuritySection />
        <OpenBankingSection />
        <ArchitectureSection />
        <SDKSection />
        <AdvancedFeaturesGate />
        <AutoDocNavigation />
      </div>
    </>
  );
}
