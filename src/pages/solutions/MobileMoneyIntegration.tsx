import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Zap, Shield, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MobileMoneyIntegration() {
  const navigate = useNavigate();

  const providers = [
    { name: "MTN Mobile Money", logo: "🟡", coverage: "60% market share" },
    { name: "Orange Money", logo: "🟠", coverage: "35% market share" },
    { name: "Express Union Mobile", logo: "🔵", coverage: "Growing" }
  ];

  const features = [
    "Collection & Disbursement APIs",
    "Real-time balance checks",
    "Transaction status webhooks",
    "Automatic reconciliation",
    "Multi-currency support (XAF/XOF)",
    "Fraud detection & prevention"
  ];

  return (
    <>
      <SEO
        title="Mobile Money Integration API for Cameroon | MTN & Orange Money"
        description="Integrate MTN Mobile Money and Orange Money with a single API. Accept payments, disburse funds, and reconcile transactions automatically in Cameroon."
        keywords="MTN Mobile Money API, Orange Money API, mobile money Cameroon, XAF mobile payments, mobile wallet integration, Cameroon payment gateway"
        canonical="https://kangopenbanking.com/solutions/mobile-money-integration"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Mobile Money Integration", url: "/solutions/mobile-money-integration" }
        ]}
      />

      <div className="min-h-screen bg-background">
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <Badge className="mb-4">Mobile Money</Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                One API for All Mobile Money Providers
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Stop integrating with multiple mobile money providers. Connect to MTN, Orange, 
                and Express Union with a single, unified API.
              </p>
              <Button size="lg" onClick={() => navigate('/developer/mobile-integration')}>
                View Documentation
              </Button>
            </div>

            {/* Provider Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-16">
              {providers.map((provider, index) => (
                <Card key={index} className="p-6 text-center">
                  <div className="text-4xl mb-3">{provider.logo}</div>
                  <h3 className="font-semibold mb-2">{provider.name}</h3>
                  <p className="text-sm text-muted-foreground">{provider.coverage}</p>
                </Card>
              ))}
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* API Example */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-8 text-center">Simple Integration</h2>
            <Card className="p-6 bg-card">
              <pre className="text-sm overflow-x-auto">
                <code>{`// Charge a mobile money account
const result = await kob.mobileMoney.charge({
  phone: '+237670000000',
  amount: 5000, // XAF
  provider: 'MTN', // or 'ORANGE'
  description: 'Payment for order #1234'
});

console.log(result.status); // 'success'
console.log(result.transactionId); // 'MM-2026-...'`}</code>
              </pre>
            </Card>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-12 text-center">Perfect For</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6">
                <Smartphone className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">E-commerce Platforms</h3>
                <p className="text-muted-foreground">Accept mobile money payments at checkout</p>
              </Card>
              <Card className="p-6">
                <Zap className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Gig Economy Apps</h3>
                <p className="text-muted-foreground">Pay drivers, freelancers instantly</p>
              </Card>
              <Card className="p-6">
                <RefreshCw className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Bill Payment Services</h3>
                <p className="text-muted-foreground">Collect utility payments seamlessly</p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-primary/5">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">Start Accepting Mobile Money Today</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Get instant access to sandbox environment with realistic test data
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" onClick={() => navigate('/developer/sandbox')}>
                Try Sandbox
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/contact')}>
                Talk to Sales
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}