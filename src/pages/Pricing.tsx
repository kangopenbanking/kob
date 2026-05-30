import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { 
  Check, 
  X, 
  ArrowRight, 
  Calculator, 
  TrendingUp,
  Zap,
  Building2,
  Crown,
  Sparkles
} from "lucide-react";

const pricingTiers = [
  {
    name: "Sandbox",
    icon: Zap,
    price: "Free",
    period: "Forever",
    description: "Perfect for testing and development",
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    features: [
      { text: "Unlimited API calls in sandbox", included: true },
      { text: "Full API documentation access", included: true },
      { text: "Code examples & SDKs", included: true },
      { text: "Community support", included: true },
      { text: "Test Mobile Money transactions", included: true },
      { text: "Production API access", included: false },
      { text: "SLA guarantee", included: false },
      { text: "Dedicated support", included: false },
    ],
    cta: "Get Started Free",
    link: "/register",
    popular: false
  },
  {
    name: "Starter",
    icon: TrendingUp,
    price: "Pay as you go",
    period: "Per transaction",
    description: "Ideal for growing businesses",
    color: "text-green-500",
    bgColor: "bg-green-500",
    features: [
      { text: "Production API access", included: true },
      { text: "Up to 10,000 transactions/month", included: true },
      { text: "AISP: 50 XAF per request", included: true },
      { text: "PISP: 0.5% per transaction", included: true },
      { text: "Mobile Money: 3.5% + 100 XAF", included: true },
      { text: "Email support (24-48h response)", included: true },
      { text: "99.5% uptime SLA", included: true },
      { text: "Volume discounts available", included: true },
    ],
    cta: "Start Integration",
    link: "/register",
    popular: true
  },
  {
    name: "Professional",
    icon: Building2,
    price: "150,000 XAF",
    period: "Per month",
    description: "For established financial institutions",
    color: "text-purple-500",
    bgColor: "bg-purple-500",
    features: [
      { text: "Everything in Starter", included: true },
      { text: "Up to 100,000 transactions/month", included: true },
      { text: "Reduced per-transaction fees (25% off)", included: true },
      { text: "Priority email support (12h response)", included: true },
      { text: "Phone support (business hours)", included: true },
      { text: "99.9% uptime SLA", included: true },
      { text: "Quarterly business reviews", included: true },
      { text: "Custom fee structures", included: true },
    ],
    cta: "Contact Sales",
    link: "/contact",
    popular: false
  },
  {
    name: "Enterprise",
    icon: Crown,
    price: "Custom",
    period: "Contact us",
    description: "Tailored for large-scale operations",
    color: "text-orange-500",
    bgColor: "bg-orange-500",
    features: [
      { text: "Everything in Professional", included: true },
      { text: "Unlimited transactions", included: true },
      { text: "Custom pricing negotiation", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "24/7 priority support", included: true },
      { text: "99.95% uptime SLA", included: true },
      { text: "White-label options", included: true },
      { text: "Custom integration support", included: true },
    ],
    cta: "Talk to Sales",
    link: "/contact",
    popular: false
  }
];

const apiPricing = [
  {
    category: "AISP (Account Information)",
    items: [
      { endpoint: "GET /aisp-accounts", starter: "50 XAF", pro: "37.5 XAF", enterprise: "Custom" },
      { endpoint: "GET /aisp-balances/:id", starter: "30 XAF", pro: "22.5 XAF", enterprise: "Custom" },
      { endpoint: "GET /aisp-transactions/:id", starter: "50 XAF", pro: "37.5 XAF", enterprise: "Custom" },
    ]
  },
  {
    category: "PISP (Payment Initiation)",
    items: [
      { endpoint: "POST /pisp-domestic-payment", starter: "0.5% + 100 XAF", pro: "0.375% + 75 XAF", enterprise: "Custom" },
      { endpoint: "GET /pisp-payment-details/:id", starter: "25 XAF", pro: "18.75 XAF", enterprise: "Custom" },
    ]
  },
  {
    category: "Mobile Money",
    items: [
      { endpoint: "POST /mobile-money-charge", starter: "3.5% + 100 XAF", pro: "1.125% + 75 XAF", enterprise: "Custom" },
      { endpoint: "POST /mobile-money-transfer", starter: "3.5% + 100 XAF", pro: "1.125% + 75 XAF", enterprise: "Custom" },
    ]
  },
  {
    category: "Banking Operations",
    items: [
      { endpoint: "POST /bank-reconcile", starter: "200 XAF", pro: "150 XAF", enterprise: "Custom" },
      { endpoint: "POST /generate-bank-statement", starter: "500 XAF", pro: "375 XAF", enterprise: "Custom" },
      { endpoint: "POST /bulk-transfers", starter: "0.3% per transfer", pro: "0.225% per transfer", enterprise: "Custom" },
    ]
  }
];

export default function Pricing() {
  const [transactions, setTransactions] = useState(1000);
  const [avgAmount, setAvgAmount] = useState(50000);

  const calculateCost = () => {
    // AISP calls (assume 2 per transaction)
    const aispCost = transactions * 2 * 50;
    // PISP calls (0.5% of transaction amount)
    const pispCost = transactions * avgAmount * 0.005;
    // Mobile Money (1.5% + 100 XAF)
    const mmCost = transactions * (avgAmount * 0.035 + 100);
    
    return {
      aisp: Math.round(aispCost),
      pisp: Math.round(pispCost),
      mobileMoney: Math.round(mmCost),
      total: Math.round(aispCost + pispCost + mmCost)
    };
  };

  const costs = calculateCost();

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Hero Section */}
      <div className="text-center mb-12 space-y-4">
        <Badge variant="outline" className="mb-4">Transparent Pricing</Badge>
        <h1 className="text-4xl md:text-5xl font-bold">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Start free with sandbox testing. Pay only for what you use in production.
          No hidden fees, no surprises.
        </p>
      </div>

      {/* Pricing Tiers */}
      <h2 className="sr-only">Pricing plans</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {pricingTiers.map((tier) => {
          const Icon = tier.icon;
          return (
            <Card 
              key={tier.name} 
              className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className={`${tier.bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="pt-4">
                  <div className="text-3xl font-bold">{tier.price}</div>
                  <div className="text-sm text-muted-foreground">{tier.period}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className="w-full" variant={tier.popular ? "default" : "outline"}>
                  <Link to={tier.link}>
                    {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Separator />
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cost Calculator */}
      <Card className="mb-12 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Pricing Calculator
          </CardTitle>
          <CardDescription>
            Estimate your monthly costs based on expected transaction volume
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="transactions">Monthly Transactions</Label>
              <Input
                id="transactions"
                type="number"
                value={transactions}
                onChange={(e) => setTransactions(Number(e.target.value))}
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Number of transactions per month
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avgAmount">Average Transaction Amount (XAF)</Label>
              <Input
                id="avgAmount"
                type="number"
                value={avgAmount}
                onChange={(e) => setAvgAmount(Number(e.target.value))}
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                Average value per transaction
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-semibold">Estimated Monthly Costs (Starter Tier)</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">AISP Requests</div>
                <div className="text-2xl font-bold">{costs.aisp.toLocaleString()} XAF</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ~{transactions * 2} requests × 50 XAF
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">PISP Payments</div>
                <div className="text-2xl font-bold">{costs.pisp.toLocaleString()} XAF</div>
                <div className="text-xs text-muted-foreground mt-1">
                  0.5% of {(transactions * avgAmount).toLocaleString()} XAF
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Mobile Money</div>
                <div className="text-2xl font-bold">{costs.mobileMoney.toLocaleString()} XAF</div>
                <div className="text-xs text-muted-foreground mt-1">
                  3.5% + 100 XAF per transaction
                </div>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg border-2 border-primary">
                <div className="text-sm text-muted-foreground mb-1">Total Estimated Cost</div>
                <div className="text-3xl font-bold text-primary">{costs.total.toLocaleString()} XAF</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Per month on Starter plan
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>💡 Pro Tip:</strong> Professional tier offers 25% discount on all fees.
              With {transactions} transactions, you'd save approximately{" "}
              <strong>{Math.round(costs.total * 0.25).toLocaleString()} XAF/month</strong>.
              Consider Professional if your costs exceed 200,000 XAF/month.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detailed API Pricing */}
      <Tabs defaultValue="aisp" className="mb-12">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aisp">AISP</TabsTrigger>
          <TabsTrigger value="pisp">PISP</TabsTrigger>
          <TabsTrigger value="mobile">Mobile Money</TabsTrigger>
          <TabsTrigger value="banking">Banking Ops</TabsTrigger>
        </TabsList>

        {apiPricing.map((category) => (
          <TabsContent 
            key={category.category.toLowerCase().replace(/\s/g, '-')} 
            value={category.category.toLowerCase().split('(')[0].trim().replace(/\s/g, '-')}
            className="mt-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>{category.category}</CardTitle>
                <CardDescription>Per-endpoint pricing across different tiers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">Endpoint</th>
                        <th className="text-left py-3 px-4 font-semibold">Starter</th>
                        <th className="text-left py-3 px-4 font-semibold">Professional</th>
                        <th className="text-left py-3 px-4 font-semibold">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.items.map((item, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-3 px-4 font-mono text-sm">{item.endpoint}</td>
                          <td className="py-3 px-4">{item.starter}</td>
                          <td className="py-3 px-4 text-green-600 font-semibold">{item.pro}</td>
                          <td className="py-3 px-4 text-purple-600 font-semibold">{item.enterprise}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* FAQ Section */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Pricing FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">Are there any setup fees?</h4>
            <p className="text-sm text-muted-foreground">
              No. There are no setup fees, onboarding fees, or hidden charges. You only pay for
              API usage in production. Sandbox testing is completely free.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Can I switch between pricing tiers?</h4>
            <p className="text-sm text-muted-foreground">
              Yes. You can upgrade or downgrade your plan at any time. Changes take effect
              at the start of the next billing cycle.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Do you offer volume discounts?</h4>
            <p className="text-sm text-muted-foreground">
              Yes. Professional tier includes a 25% discount on all per-transaction fees.
              Enterprise tier offers custom pricing based on your volume. Contact sales for details.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">What payment methods do you accept?</h4>
            <p className="text-sm text-muted-foreground">
              We accept bank transfers, mobile money (MTN/Orange), and card payments.
              Invoices are generated monthly and can be paid within 15 days.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Is there a minimum contract period?</h4>
            <p className="text-sm text-muted-foreground">
              No. Starter tier is month-to-month with no minimum commitment. Professional and
              Enterprise tiers may include annual contracts with discounted rates.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">What happens if I exceed my tier limits?</h4>
            <p className="text-sm text-muted-foreground">
              We'll notify you when you approach your tier limits. You can either upgrade to
              the next tier or continue with overage charges (typically 10% premium on standard rates).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="text-center py-12 space-y-6">
          <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start building with our free sandbox environment. No credit card required.
            Upgrade to production when you're ready.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/register">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/contact">Contact Sales</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/integration-workflow">View Integration Guide</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
