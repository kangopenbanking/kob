import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Zap,
  Shield,
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowRight,
  Clock,
  Users,
  Globe,
  CreditCard,
  Building2,
  Smartphone,
  Lock,
} from "lucide-react";
import { SmartGetStartedButton } from "@/components/SmartGetStartedButton";

const PaymentFacilitation = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background py-24 md:py-32">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]"></div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-5xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 px-4 py-2">
              <Zap className="h-4 w-4 mr-2 inline" />
              White-Label Payment Processing
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Accept Payments Instantly
              <br />
              <span className="text-primary">Without Your Own Payment Account</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Start processing mobile money and bank transfers immediately using KOB's payment infrastructure. 
              No KYB delays, no setup fees, just instant payment processing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SmartGetStartedButton size="lg" className="text-lg px-10 py-6" />
              <Link to="/developer/payment-facilitation">
                <Button size="lg" variant="outline" className="text-lg px-10 py-6">
                  View API Docs
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">1.5%</div>
                <div className="text-sm text-muted-foreground">Transaction Fee</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">0 min</div>
                <div className="text-sm text-muted-foreground">Setup Time</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">$0</div>
                <div className="text-sm text-muted-foreground">Monthly Fees</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Animation Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How Payment Facilitation Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Simple 4-step process from registration to receiving settlements
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 relative">
              {/* Connection Line */}
              <div className="hidden md:block absolute top-20 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20"></div>
              
              {/* Step 1 */}
              <div className="relative">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg animate-pulse">
                    1
                  </div>
                </div>
                <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="pt-6 pb-6">
                    <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">Register</h3>
                    <p className="text-sm text-muted-foreground">
                      Sign up as Developer or Fintech and enable KOB facilitation
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg animate-pulse" style={{animationDelay: '0.3s'}}>
                    2
                  </div>
                </div>
                <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="pt-6 pb-6">
                    <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">Configure</h3>
                    <p className="text-sm text-muted-foreground">
                      Set up your settlement bank account or mobile money number
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg animate-pulse" style={{animationDelay: '0.6s'}}>
                    3
                  </div>
                </div>
                <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="pt-6 pb-6">
                    <CreditCard className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">Process Payments</h3>
                    <p className="text-sm text-muted-foreground">
                      Use our API to collect payments and make transfers
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg animate-pulse" style={{animationDelay: '0.9s'}}>
                    4
                  </div>
                </div>
                <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="pt-6 pb-6">
                    <Wallet className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-bold mb-2">Get Settled</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive automatic settlements to your configured account
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose Payment Facilitation?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Skip the complexity and start accepting payments today
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-xl">
              <CardContent className="pt-8 pb-8">
                <Zap className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Instant Activation</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>No payment account setup needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Skip lengthy KYB verification process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Start processing in minutes, not weeks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Use our pre-verified business account</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-xl">
              <CardContent className="pt-8 pb-8">
                <DollarSign className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Simple Pricing</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Only 3.5% + 100 XAF per transaction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>No setup fees or monthly charges</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Free settlement transfers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Volume discounts available</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-xl">
              <CardContent className="pt-8 pb-8">
                <Clock className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Automated Settlements</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Daily, weekly, or monthly settlements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Direct to bank or mobile money</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Transparent fee deduction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Real-time balance tracking</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Perfect For
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ideal for developers and fintechs building payment solutions
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
            <Card>
              <CardContent className="pt-8">
                <Smartphone className="h-16 w-16 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Developers</h3>
                <p className="text-muted-foreground mb-4">
                  Building apps, websites, or SaaS products that need to accept payments in Cameroon
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>E-commerce platforms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Subscription services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Mobile applications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Marketplace solutions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-8">
                <Building2 className="h-16 w-16 text-primary mb-4" />
                <h3 className="text-2xl font-bold mb-3">Fintechs</h3>
                <p className="text-muted-foreground mb-4">
                  Financial technology companies launching payment products quickly
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Digital wallets</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>P2P payment platforms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Bill payment services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Remittance solutions</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Traditional vs Payment Facilitation
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See why payment facilitation is faster and easier
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Traditional Way */}
              <Card className="border-2">
                <CardContent className="pt-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">Traditional Approach</h3>
                    <Badge variant="destructive">Slow & Complex</Badge>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-destructive text-sm">✗</span>
                      </div>
                      <div>
                        <p className="font-semibold">2-4 weeks setup time</p>
                        <p className="text-sm text-muted-foreground">Complete KYB verification</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-destructive text-sm">✗</span>
                      </div>
                      <div>
                        <p className="font-semibold">Complex documentation</p>
                        <p className="text-sm text-muted-foreground">Business registration, tax documents</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-destructive text-sm">✗</span>
                      </div>
                      <div>
                        <p className="font-semibold">Manual settlements</p>
                        <p className="text-sm text-muted-foreground">Track and request payouts</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-destructive text-sm">✗</span>
                      </div>
                      <div>
                        <p className="font-semibold">Higher complexity</p>
                        <p className="text-sm text-muted-foreground">Manage provider relationships</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Payment Facilitation */}
              <Card className="border-2 border-primary shadow-lg">
                <CardContent className="pt-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">Payment Facilitation</h3>
                    <Badge className="bg-primary">Fast & Simple</Badge>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Instant activation</p>
                        <p className="text-sm text-muted-foreground">Start in minutes</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Simple onboarding</p>
                        <p className="text-sm text-muted-foreground">Just settlement account details</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Automated settlements</p>
                        <p className="text-sm text-muted-foreground">Daily, weekly, or monthly</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Zero complexity</p>
                        <p className="text-sm text-muted-foreground">We handle everything</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Flow Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Settlement Flow Explained
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Understand how your money flows from customer to your account
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <Card className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">Customer Payment</h3>
                    <p className="text-muted-foreground">
                      Customer pays via mobile money or receives bank transfer. Money is collected through KOB's payment gateway.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="h-8 w-8 text-primary animate-bounce" style={{animationDirection: 'alternate', animationDuration: '1.5s'}} />
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">Automatic Tracking</h3>
                    <p className="text-muted-foreground">
                      KOB automatically tracks all inflows (collections) and outflows (transfers) plus the facilitation fees charged.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="h-8 w-8 text-primary animate-bounce" style={{animationDirection: 'alternate', animationDuration: '1.5s'}} />
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🔢</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">Balance Calculation</h3>
                    <p className="text-muted-foreground">
                      Formula: <code className="bg-muted px-2 py-1 rounded">Net Balance = Total Inflows - Total Outflows - KOB Fees</code>
                      <br />
                      Example: 500,000 XAF collected - 150,000 XAF transferred - 8,750 XAF fees = 341,250 XAF net balance
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="h-8 w-8 text-primary animate-bounce" style={{animationDirection: 'alternate', animationDuration: '1.5s'}} />
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">💸</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">Automated Settlement</h3>
                    <p className="text-muted-foreground">
                      Based on your schedule (daily, weekly, monthly), KOB automatically transfers your net balance to your configured bank or mobile money account.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-12 pb-12 text-center">
              <Globe className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-4xl font-bold mb-4">
                Ready to Start Processing Payments?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join developers and fintechs already using KOB Payment Facilitation to accept payments across Cameroon
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SmartGetStartedButton size="lg" className="text-lg px-10 py-6" />
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="text-lg px-10 py-6">
                    Talk to Sales
                  </Button>
                </Link>
              </div>
              
              {/* Trust Indicators */}
              <div className="mt-12 pt-8 border-t border-border/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold">PCI-DSS</p>
                    <p className="text-xs text-muted-foreground">Certified</p>
                  </div>
                  <div className="text-center">
                    <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold">Bank-Level</p>
                    <p className="text-xs text-muted-foreground">Security</p>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold">99.9%</p>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                  <div className="text-center">
                    <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold">24/7</p>
                    <p className="text-xs text-muted-foreground">Support</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default PaymentFacilitation;