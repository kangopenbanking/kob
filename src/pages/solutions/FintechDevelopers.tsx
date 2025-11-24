import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Code2, Zap, Shield, DollarSign, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FintechDevelopers() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Code2,
      title: "RESTful API Architecture",
      description: "Clean, intuitive endpoints following OpenAPI 3.0 specifications"
    },
    {
      icon: Zap,
      title: "Instant Sandbox Access",
      description: "Test your integration immediately with realistic mock data"
    },
    {
      icon: Shield,
      title: "Bank-Grade Security",
      description: "OAuth 2.0, mTLS, and FIPS 140-2 compliant encryption"
    },
    {
      icon: DollarSign,
      title: "Transparent Pricing",
      description: "Pay only for what you use with no hidden fees"
    },
    {
      icon: TrendingUp,
      title: "99.9% Uptime SLA",
      description: "Production-grade infrastructure with automatic failover"
    }
  ];

  const useCases = [
    "Build lending platforms with real-time credit scoring",
    "Create digital wallets with XAF and mobile money support",
    "Develop accounting software with automatic bank reconciliation",
    "Launch payment apps with instant bank transfers",
    "Build expense management tools with transaction categorization",
    "Create investment apps with multi-bank account aggregation"
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Kang Open Banking API for Fintech Developers",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "XAF"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "127"
    }
  };

  return (
    <>
      <SEO
        title="Banking API for Fintech Developers in Cameroon"
        description="Build innovative fintech applications with Kang Open Banking API. XAF-native banking integration, credit scoring, and mobile money support for Cameroon developers."
        keywords="Cameroon banking API, fintech developers Cameroon, XAF payment API, Open Banking Cameroon, COBAC compliant API, mobile money integration, credit scoring API"
        canonical="https://kangopenbanking.com/solutions/fintech-developers"
        structuredData={structuredData}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Fintech Developers", url: "/solutions/fintech-developers" }
        ]}
      />

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                Banking API Built for Fintech Developers
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Launch your fintech product in days, not months. Access real-time banking data, 
                payments, and credit scoring with a single, unified API for Cameroon.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button size="lg" onClick={() => navigate('/developer/quick-start')}>
                  Get Started Free
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/developer/api-keys')}>
                  Get API Keys
                </Button>
              </div>
            </div>

            {/* Code Example */}
            <Card className="p-6 bg-card/50 backdrop-blur">
              <pre className="text-sm overflow-x-auto">
                <code>{`// Get account balances in 3 lines of code
const kob = new KangOpenBanking({ apiKey: 'your_key' });
const accounts = await kob.accounts.list();
console.log(accounts[0].balance); // 1,250,000 XAF`}</code>
              </pre>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-12 text-center">Why Developers Choose KOB</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="p-6">
                  <feature.icon className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-8 text-center">What You Can Build</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {useCases.map((useCase, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <p className="text-lg">{useCase}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-primary/5">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Build the Future of Finance?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join 500+ developers already building with Kang Open Banking
            </p>
            <Button size="lg" onClick={() => navigate('/developer/quick-start')}>
              Start Building Now
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}