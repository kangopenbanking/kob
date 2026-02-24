import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  Lock,
  Shield,
  Store,
  TrendingUp,
  Users,
  Zap,
  Code,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

const ForMerchants = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Merchant Portal - Accept Payments in Cameroon | Kang Open Banking</title>
        <meta name="description" content="Accept payments via mobile money, bank transfers, and cards. Manage disputes, track settlements, and grow your business with KOB's Merchant Portal." />
      </Helmet>

      {/* Hero */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Store className="h-4 w-4 mr-2 inline" />
              Merchant Portal
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Accept Payments Across Cameroon
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Everything you need to collect payments, manage chargebacks, and settle funds — powered by KOB's unified payment gateway.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/merchant-register">
                <Button size="lg" className="text-lg px-8 py-6">
                  Get Started as Merchant
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/developer/gateway/charges">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  View API Docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How the Merchant Portal Works</h2>
              <p className="text-xl text-muted-foreground">From onboarding to your first payout in four steps</p>
            </div>
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { step: 1, title: "Register & KYB", desc: "Create an account, submit business documents, and get verified.", icon: FileText },
                { step: 2, title: "Integrate API", desc: "Add payment collection endpoints to your app or website.", icon: Code },
                { step: 3, title: "Accept Payments", desc: "Collect via mobile money, bank transfer, and card payments.", icon: CreditCard },
                { step: 4, title: "Get Settled", desc: "Automatic payouts to your bank or mobile money account.", icon: Wallet },
              ].map(({ step, title, desc, icon: Icon }) => (
                <Card key={step} className="p-6 text-center hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-lg font-bold text-primary">{step}</span>
                  </div>
                  <Icon className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Merchant Portal Features</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card className="p-6">
                <CreditCard className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Payment Collection</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Accept payments via MTN MoMo, Orange Money, bank transfers, and international cards.
                </p>
                <Link to="/developer/gateway/charges" className="text-sm text-primary hover:underline">
                  Charges API Reference →
                </Link>
              </Card>

              <Card className="p-6">
                <DollarSign className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Payouts & Settlements</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Automatic settlements to your preferred account — daily, weekly, or on-demand.
                </p>
                <Link to="/developer/gateway/payouts" className="text-sm text-primary hover:underline">
                  Payouts API Reference →
                </Link>
              </Card>

              <Card className="p-6">
                <AlertTriangle className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Dispute Management</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Track chargebacks, submit evidence, and resolve disputes from a single dashboard.
                </p>
                <Link to="/developer/gateway/disputes" className="text-sm text-primary hover:underline">
                  Disputes API Reference →
                </Link>
              </Card>

              <Card className="p-6">
                <Shield className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">KYB Verification</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Streamlined business verification with document upload and compliance checks.
                </p>
                <Link to="/merchant-register" className="text-sm text-primary hover:underline">
                  Start Verification →
                </Link>
              </Card>

              <Card className="p-6">
                <TrendingUp className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Analytics Dashboard</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Real-time revenue metrics, transaction breakdowns, and performance trends.
                </p>
                <Link to="/merchant" className="text-sm text-primary hover:underline">
                  Access Dashboard →
                </Link>
              </Card>

              <Card className="p-6">
                <Lock className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">API Keys & Security</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Manage sandbox and production keys, configure webhooks, and rotate credentials.
                </p>
                <Link to="/developer/getting-started" className="text-sm text-primary hover:underline">
                  Developer Quick Start →
                </Link>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* API Integration Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">
                <Code className="h-4 w-4 mr-2 inline" />
                API Integration
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Integrate in Minutes
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Use our RESTful APIs to embed payment collection into any application
              </p>
            </div>

            <Card className="p-8 bg-muted/50 mb-8">
              <h3 className="text-lg font-bold mb-4">Quick Start: Create a Charge</h3>
              <pre className="bg-background p-6 rounded-lg overflow-x-auto text-sm border">
{`POST /v1/gateway/charges
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "amount": 50000,
  "currency": "XAF",
  "payment_method": "mobile_money",
  "provider": "mtn_momo",
  "customer": {
    "phone": "+237670000000",
    "name": "John Doe"
  },
  "metadata": {
    "order_id": "ORD-12345"
  }
}`}
              </pre>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
              <Link to="/developer/gateway/charges" className="block">
                <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1 h-full">
                  <Zap className="h-8 w-8 text-primary mb-3" />
                  <h4 className="font-bold mb-2">Charges API</h4>
                  <p className="text-sm text-muted-foreground">Create and manage payment charges</p>
                </Card>
              </Link>
              <Link to="/developer/gateway/payouts" className="block">
                <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1 h-full">
                  <DollarSign className="h-8 w-8 text-primary mb-3" />
                  <h4 className="font-bold mb-2">Payouts API</h4>
                  <p className="text-sm text-muted-foreground">Initiate and track fund settlements</p>
                </Card>
              </Link>
              <Link to="/developer/gateway/disputes" className="block">
                <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1 h-full">
                  <AlertTriangle className="h-8 w-8 text-primary mb-3" />
                  <h4 className="font-bold mb-2">Disputes API</h4>
                  <p className="text-sm text-muted-foreground">Handle chargebacks and evidence</p>
                </Card>
              </Link>
            </div>

            <div className="text-center mt-8">
              <Link to="/developer">
                <Button variant="outline" size="lg">
                  Full Developer Documentation
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Snapshot */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Simple, Transparent Pricing</h2>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="p-6">
                <div className="text-3xl font-bold text-primary mb-2">3.5%</div>
                <p className="text-sm text-muted-foreground">+ 100 XAF per transaction</p>
              </Card>
              <Card className="p-6">
                <div className="text-3xl font-bold text-primary mb-2">0 XAF</div>
                <p className="text-sm text-muted-foreground">Setup or monthly fees</p>
              </Card>
              <Card className="p-6">
                <div className="text-3xl font-bold text-primary mb-2">T+1</div>
                <p className="text-sm text-muted-foreground">Settlement timeline</p>
              </Card>
            </div>
            <Link to="/pricing">
              <Button variant="outline">View Full Pricing</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Start Accepting Payments Today</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Register as a merchant, complete verification, and go live in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/merchant-register">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Register as Merchant
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-blue-600 hover:bg-primary-foreground hover:text-primary">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ForMerchants;
