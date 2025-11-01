import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Shield,
  Zap,
  Globe,
  Lock,
  CheckCircle,
  Code,
  Smartphone,
  Building2,
  Users,
  TrendingUp,
  Clock,
  FileText,
  BarChart3,
  DollarSign,
  Wallet,
  CreditCard,
  PieChart,
  ArrowRight,
  Database,
} from "lucide-react";
import heroBanner from "@/assets/hero-banner-kob.png";
import { SmartGetStartedButton } from "@/components/SmartGetStartedButton";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden animated-gradient-banner">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent"></div>
        <div className="container mx-auto px-4 py-24 md:py-40 relative">
          <div className="max-w-5xl mx-auto text-center">
            <div className="space-y-8 animate-fade-in">
              <Badge variant="outline" className="px-6 py-2 text-sm font-medium border-white/30 bg-white/90 text-blue-900">
                <Globe className="h-4 w-4 inline mr-2" />
                🇨🇲 Cameroon's #1 Open Banking Platform
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">
                Unified Banking API for Cameroon
              </h1>
              <p className="text-xl md:text-2xl text-white/95 drop-shadow-md font-medium leading-relaxed max-w-3xl mx-auto">
                Connect to banks, credit unions, and mobile money operators across Cameroon with a single, 
                enterprise-grade API. COBAC & BEAC compliant.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <SmartGetStartedButton size="lg" className="text-lg px-10 py-6 shadow-lg hover:shadow-xl transition-shadow" />
                <Link to="/documentation">
                  <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-2 bg-white/95 hover:bg-white text-blue-900 border-white/30">
                    View Documentation
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-8 pt-8 justify-center">
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 border border-white/30">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-blue-900">99.9% Uptime SLA</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 border border-white/30">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">COBAC Compliant</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 border border-white/30">
                  <Lock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">PCI-DSS Certified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"></div>
      </section>

      {/* Portal Access Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three Portals, One Platform
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Access the right tools for your role in the banking ecosystem
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 hover:shadow-lg transition-all hover:-translate-y-1">
              <Code className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Developer Portal</h3>
              <p className="text-muted-foreground mb-6">
                Build and test integrations with our comprehensive API documentation, sandbox environment, and SDKs.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Interactive API documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Sandbox testing environment</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Code examples & SDKs</span>
                </li>
              </ul>
              <Link to="/developer">
                <Button className="w-full">Access Developer Portal</Button>
              </Link>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all hover:-translate-y-1 border-primary">
              <Building2 className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Admin Portal</h3>
              <p className="text-muted-foreground mb-6">
                Manage your institution's integration, monitor compliance, and oversee operations.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Institution management</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Compliance reporting</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>User & role management</span>
                </li>
              </ul>
              <Link to="/admin">
                <Button className="w-full" variant="outline">Access Admin Portal</Button>
              </Link>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all hover:-translate-y-1">
              <BarChart3 className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Banking Ops</h3>
              <p className="text-muted-foreground mb-6">
                Monitor transactions, perform reconciliations, and manage banking operations in real-time.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Transaction monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automated reconciliation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Bulk operations</span>
                </li>
              </ul>
              <Link to="/banking-ops">
                <Button className="w-full">Access Banking Ops</Button>
              </Link>
            </Card>
          </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent"></div>
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center text-primary-foreground">
            <div className="space-y-3 animate-fade-in">
              <div className="text-5xl md:text-6xl font-bold mb-2 tracking-tight">25+</div>
              <div className="text-sm md:text-base opacity-90 font-medium">Financial Institutions</div>
              <div className="h-1 w-16 bg-primary-foreground/30 mx-auto rounded-full"></div>
            </div>
            <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-5xl md:text-6xl font-bold mb-2 tracking-tight">99.9%</div>
              <div className="text-sm md:text-base opacity-90 font-medium">Uptime Guarantee</div>
              <div className="h-1 w-16 bg-primary-foreground/30 mx-auto rounded-full"></div>
            </div>
            <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-5xl md:text-6xl font-bold mb-2 tracking-tight">&lt;200ms</div>
              <div className="text-sm md:text-base opacity-90 font-medium">Avg Response Time</div>
              <div className="h-1 w-16 bg-primary-foreground/30 mx-auto rounded-full"></div>
            </div>
            <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="text-5xl md:text-6xl font-bold mb-2 tracking-tight">1M+</div>
              <div className="text-sm md:text-base opacity-90 font-medium">API Calls Daily</div>
              <div className="h-1 w-16 bg-primary-foreground/30 mx-auto rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Core APIs Section */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4">Core APIs</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Powerful APIs for Modern Banking
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to build innovative financial services
            </p>
          </div>

          {/* Account Information API */}
          <div className="mb-24 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <Database className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">Account Information Service</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Real-Time Account Access
                </h3>
                <p className="text-lg text-muted-foreground">
                  Access account balances, transaction history, and account details across multiple banks 
                  with a single API integration. AISP compliant with full COBAC regulatory approval.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Multi-Bank Aggregation</strong>
                      <span className="text-muted-foreground">Connect to 25+ banks with one integration</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Real-Time Sync</strong>
                      <span className="text-muted-foreground">Instant balance and transaction updates</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Secure Access</strong>
                      <span className="text-muted-foreground">OAuth 2.0 with explicit user consent</span>
                    </div>
                  </li>
                </ul>
                <Link to="/guides/aisp">
                  <Button size="lg" className="group">
                    Explore AISP
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <Card className="p-8 shadow-xl border-2 hover:shadow-2xl transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">Current Balance</span>
                    <span className="text-2xl font-bold">2,450,000 XAF</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Salary Deposit</p>
                          <p className="text-xs text-muted-foreground">Today, 09:30</p>
                        </div>
                      </div>
                      <span className="font-bold text-green-600">+450,000 XAF</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                          <Smartphone className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">MTN MoMo Transfer</p>
                          <p className="text-xs text-muted-foreground">Yesterday, 14:22</p>
                        </div>
                      </div>
                      <span className="font-bold">-25,000 XAF</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Payment Initiation API */}
          <div className="mb-24 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Card className="p-8 shadow-xl border-2 hover:shadow-2xl transition-shadow order-2 md:order-1">
                <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-muted-foreground">Send Money</span>
                      <Badge>Instant</Badge>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground">Recipient</label>
                        <p className="font-semibold">Orange Money - 670 XXX XXX</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Amount</label>
                        <p className="text-3xl font-bold">50,000 XAF</p>
                      </div>
                      <Button className="w-full" size="lg">
                        <Lock className="mr-2 h-4 w-4" />
                        Confirm Payment
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    <span>Secured with SCA authentication</span>
                  </div>
                </div>
              </Card>
              <div className="space-y-6 animate-fade-in order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                  <Zap className="h-5 w-5 text-accent" />
                  <span className="text-sm font-semibold text-accent">Payment Initiation Service</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Instant Payment Initiation
                </h3>
                <p className="text-lg text-muted-foreground">
                  Enable seamless payments directly from customer bank accounts to any destination. 
                  Support for domestic transfers, mobile money, and international payments.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">One-Click Payments</strong>
                      <span className="text-muted-foreground">Simplified checkout with bank transfers</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Mobile Money</strong>
                      <span className="text-muted-foreground">MTN, Orange Money, Express Union</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Strong Security</strong>
                      <span className="text-muted-foreground">SCA compliant with 3D Secure support</span>
                    </div>
                  </li>
                </ul>
                <Link to="/guides/pisp">
                  <Button size="lg" variant="outline" className="group border-2">
                    Explore PISP
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Loans & Credit Section */}
          <div className="mb-24 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">Lending & Credit</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Automated Loan Decisioning
                </h3>
                <p className="text-lg text-muted-foreground">
                  Comprehensive loan management with automated credit scoring (300-850), instant decisions, 
                  and intelligent risk assessment powered by hybrid data sources.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Instant Credit Scoring</strong>
                      <span className="text-muted-foreground">Real-time scores with NjangiBox integration</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Auto-Approval</strong>
                      <span className="text-muted-foreground">Pre-approve loans with score ≥700</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Smart Risk Assessment</strong>
                      <span className="text-muted-foreground">DTI calculations and sanctions screening</span>
                    </div>
                  </li>
                </ul>
                <div className="flex gap-4">
                  <Link to="/loans">
                    <Button size="lg" className="group">
                      Apply for Loan
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link to="/credit-scores-info">
                    <Button size="lg" variant="outline">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
              <Card className="p-8 shadow-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 hover:shadow-2xl transition-shadow">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">Credit Score</h4>
                    <Badge variant="outline" className="bg-background">Excellent</Badge>
                  </div>
                  <div className="text-center py-6">
                    <div className="text-6xl font-bold text-primary mb-2">750</div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span>+25 points this month</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Payment History</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: "95%" }}></div>
                        </div>
                        <span className="font-medium">95%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Credit Utilization</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: "32%" }}></div>
                        </div>
                        <span className="font-medium">32%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Savings Behavior</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: "88%" }}></div>
                        </div>
                        <span className="font-medium">88%</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground text-center">
                      Eligible for loans up to <strong className="text-foreground">5,000,000 XAF</strong> at <strong className="text-primary">8.5% APR</strong>
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Savings Section */}
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Card className="p-8 shadow-xl border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-primary/5 hover:shadow-2xl transition-shadow order-2 md:order-1">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">High-Yield Savings</h4>
                    <Badge className="bg-accent">6.5% APY</Badge>
                  </div>
                  <div className="p-6 bg-background rounded-xl border">
                    <div className="text-sm text-muted-foreground mb-2">Current Balance</div>
                    <div className="text-4xl font-bold mb-4">1,250,000 XAF</div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Interest Earned (YTD)</span>
                      <span className="font-bold text-accent">+45,750 XAF</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <span className="text-sm font-medium">Base Rate</span>
                      <span className="font-bold">6.0%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg border border-accent/20">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">Credit Score Bonus</span>
                      </div>
                      <span className="font-bold text-accent">+0.5%</span>
                    </div>
                  </div>
                </div>
              </Card>
              <div className="space-y-6 animate-fade-in order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                  <Wallet className="h-5 w-5 text-accent" />
                  <span className="text-sm font-semibold text-accent">Savings Accounts</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Grow Your Wealth
                </h3>
                <p className="text-lg text-muted-foreground">
                  High-yield savings accounts with competitive interest rates. Earn bonus rates based on your 
                  credit score and watch your money grow automatically.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Competitive Rates</strong>
                      <span className="text-muted-foreground">Up to 6.5% APY with credit bonuses</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Automatic Interest</strong>
                      <span className="text-muted-foreground">Daily compounding, monthly payouts</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="block mb-1">Flexible Access</strong>
                      <span className="text-muted-foreground">Withdraw anytime without penalties</span>
                    </div>
                  </li>
                </ul>
                <Link to="/savings">
                  <Button size="lg" variant="outline" className="group border-2">
                    Open Savings Account
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Security & Compliance Section */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Enterprise Security</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Bank-Grade Security & Compliance
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your data is protected with military-grade encryption and compliance with international standards
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 hover:shadow-lg transition-shadow group">
              <Shield className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">Bank-Grade Security</h3>
              <p className="text-muted-foreground text-sm">
                TLS 1.3 encryption, AES-256 at rest, PCI-DSS Level 1 certified with 24/7 monitoring.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow group">
              <Lock className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">Regulatory Compliant</h3>
              <p className="text-muted-foreground text-sm">
                Full COBAC & BEAC compliance with automated reporting and comprehensive audit trails.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow group">
              <Globe className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">CEMAC Coverage</h3>
              <p className="text-muted-foreground text-sm">
                Access banks and mobile money across Cameroon and the Central African region.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow group">
              <Clock className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold mb-2">Real-Time Data</h3>
              <p className="text-muted-foreground text-sm">
                Instant account balances, transactions, and payment status updates in real-time.
              </p>
            </Card>
          </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple integration process from sandbox to production
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-bold mb-2">Register</h3>
              <p className="text-sm text-muted-foreground">
                Create your account and complete KYC verification
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-bold mb-2">Test</h3>
              <p className="text-sm text-muted-foreground">
                Integrate using our sandbox environment and test APIs
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-bold mb-2">Deploy</h3>
              <p className="text-sm text-muted-foreground">
                Get production credentials and go live
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-lg font-bold mb-2">Scale</h3>
              <p className="text-sm text-muted-foreground">
                Monitor, optimize, and grow your integration
              </p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powering Innovation Across Fintech
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <Users className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Account Aggregation</h3>
              <p className="text-muted-foreground">
                Build personal finance apps that aggregate accounts from multiple banks for a unified view.
              </p>
            </Card>

            <Card className="p-6">
              <Zap className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Payment Initiation</h3>
              <p className="text-muted-foreground">
                Enable instant payments and transfers directly from users' bank accounts.
              </p>
            </Card>

            <Card className="p-6">
              <TrendingUp className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Lending Platforms</h3>
              <p className="text-muted-foreground">
                Access transaction data for credit scoring and automated loan decisioning with 300-850 scoring.
              </p>
              <Link to="/credit-scores-info" className="text-sm text-primary hover:underline mt-2 inline-block">
                Learn about Credit Scoring →
              </Link>
            </Card>

            <Card className="p-6">
              <FileText className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Business Tools</h3>
              <p className="text-muted-foreground">
                Build accounting, invoicing, and reconciliation tools for businesses.
              </p>
            </Card>
          </div>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Trusted by Leading Financial Institutions
            </h2>
            <p className="text-muted-foreground">
              Connected to major banks, credit unions, and mobile money providers
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
            <div className="text-center text-2xl font-bold">Banking</div>
            <div className="text-center text-2xl font-bold">Orange Money</div>
            <div className="text-center text-2xl font-bold">MTN MoMo</div>
            <div className="text-center text-2xl font-bold">CamCCUL</div>
          </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Transform Financial Services?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join leading fintechs building on Cameroon's most reliable open banking platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SmartGetStartedButton size="lg" variant="secondary" className="text-lg px-8" />
            <Link to="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-blue-600 hover:bg-primary-foreground hover:text-primary">
                Contact Sales
              </Button>
            </Link>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
