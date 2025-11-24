import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, Zap, BarChart3, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CreditScoring() {
  const navigate = useNavigate();

  const dataPoints = [
    "Banking transaction history",
    "Mobile money usage patterns",
    "Loan repayment history",
    "Savings behavior",
    "Bill payment consistency",
    "Income stability"
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Instant Decisions",
      description: "Get credit scores in under 2 seconds via API"
    },
    {
      icon: Shield,
      title: "COBAC Compliant",
      description: "Fully compliant with Central African banking regulations"
    },
    {
      icon: BarChart3,
      title: "Explainable AI",
      description: "Understand the factors behind each score"
    },
    {
      icon: TrendingUp,
      title: "Predictive Analytics",
      description: "30-day default probability predictions"
    }
  ];

  return (
    <>
      <SEO
        title="Credit Scoring API for Cameroon | Alternative Credit Data"
        description="Real-time credit scoring API using banking data, mobile money, and alternative data. COBAC compliant credit assessment for Cameroon lenders."
        keywords="credit scoring API Cameroon, alternative credit data, COBAC compliant scoring, lending API, credit risk assessment, fintech credit scoring"
        canonical="https://kangopenbanking.com/solutions/credit-scoring"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Credit Scoring", url: "/solutions/credit-scoring" }
        ]}
      />

      <div className="min-h-screen bg-background">
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <Badge className="mb-4">Credit Scoring</Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                AI-Powered Credit Scoring for Cameroon
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Make smarter lending decisions with real-time credit scores based on banking data, 
                mobile money transactions, and alternative data sources.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button size="lg" onClick={() => navigate('/crediq')}>
                  Try CrediQ
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/developer/api-explorer')}>
                  API Documentation
                </Button>
              </div>
            </div>

            {/* Score Range */}
            <Card className="p-8 bg-gradient-to-r from-primary/10 to-primary/5 mb-16">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="text-center flex-1">
                  <div className="text-4xl font-bold text-destructive mb-2">300-579</div>
                  <div className="text-sm text-muted-foreground">Poor</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-bold text-yellow-500 mb-2">580-669</div>
                  <div className="text-sm text-muted-foreground">Fair</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-bold text-blue-500 mb-2">670-739</div>
                  <div className="text-sm text-muted-foreground">Good</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-bold text-green-500 mb-2">740-799</div>
                  <div className="text-sm text-muted-foreground">Very Good</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl font-bold text-primary mb-2">800-850</div>
                  <div className="text-sm text-muted-foreground">Excellent</div>
                </div>
              </div>
            </Card>

            {/* Data Points */}
            <h2 className="text-2xl font-bold mb-6 text-center">Data Sources</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-16">
              {dataPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-2 gap-8">
              {benefits.map((benefit, index) => (
                <Card key={index} className="p-6">
                  <benefit.icon className="h-10 w-10 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* API Example */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-8 text-center">Simple API Integration</h2>
            <Card className="p-6">
              <pre className="text-sm overflow-x-auto">
                <code>{`// Get credit score with user consent
const score = await kob.creditScore.calculate({
  userId: 'user-123',
  consentId: 'consent-abc',
  includeFactors: true
});

console.log(score.value); // 742
console.log(score.category); // 'very_good'
console.log(score.defaultProbability); // 0.03 (3%)
console.log(score.factors); // Array of contributing factors`}</code>
              </pre>
            </Card>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-12 text-center">Who Uses Credit Scoring API</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 text-center">
                <div className="text-4xl mb-3">🏦</div>
                <h3 className="font-semibold mb-2">Digital Lenders</h3>
                <p className="text-sm text-muted-foreground">
                  Automate loan approval with AI-powered risk assessment
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl mb-3">🏢</div>
                <h3 className="font-semibold mb-2">Microfinance Institutions</h3>
                <p className="text-sm text-muted-foreground">
                  Reach unbanked customers with alternative credit data
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="text-4xl mb-3">🛒</div>
                <h3 className="font-semibold mb-2">BNPL Platforms</h3>
                <p className="text-sm text-muted-foreground">
                  Offer buy-now-pay-later with instant credit checks
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-primary/5">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">Start Scoring Credit Today</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Get API access and start making better lending decisions
            </p>
            <Button size="lg" onClick={() => navigate('/contact')}>
              Request Demo
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}