import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  Code,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  FlaskConical,
  Globe,
  Home,
  Lock,
  PieChart,
  PiggyBank,
  Rocket,
  Shield,
  Smartphone,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
  MapPin,
  X,
} from "lucide-react";
import heroBanner from "@/assets/hero-banner-kob.png";
import crediqHeroBg from "@/assets/crediq-hero-bg.png";
import banksKob from "@/assets/banks-kob.jpg";
import developerKang from "@/assets/developer-kang.png";
import merchantsKob from "@/assets/merchants-kob.webp";
import { SmartGetStartedButton } from "@/components/SmartGetStartedButton";
import { ProductTour } from "@/components/ProductTour";
import { HomepageHeroSlider } from "@/components/HomepageHeroSlider";
import { motion } from "framer-motion";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section - Admin-managed slider with static fallback */}
      <HomepageHeroSlider fallback={
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
      } />

      {/* Portal Access Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">Platform</Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Three Portals, One Platform
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Access the right tools for your role in the banking ecosystem
              </p>
            </div>

            {/* Portal 1 - Banking Ops - Image Left */}
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-16">
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
                <img src={banksKob} alt="Banking Operations" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Banking Ops</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">Banking Operations Portal</h3>
                <p className="text-muted-foreground text-lg">
                  Monitor transactions, perform reconciliations, and manage banking operations in real-time.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Transaction monitoring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Automated reconciliation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Bulk operations</span>
                  </li>
                </ul>
                <Link to="/banking-ops">
                  <Button size="lg" className="mt-2">
                    Access Banking Ops <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Portal 2 - Merchant Portal - Image Right */}
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-16">
              <div className="space-y-5 md:order-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <Store className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Merchant Portal</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">Merchant Portal</h3>
                <p className="text-muted-foreground text-lg">
                  Accept payments, manage disputes, and track settlements with self-service tools.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Payment collection & payouts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Dispute & chargeback management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>KYB verification & API keys</span>
                  </li>
                </ul>
                <Link to="/for-merchants">
                  <Button size="lg" className="mt-2">
                    Learn More <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/3] md:order-2">
                <img src={merchantsKob} alt="Merchant Portal" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Portal 3 - Developer Portal - Image Left */}
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-16">
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/3] bg-muted">
                <img src={developerKang} alt="Developer Portal" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <Code className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Developer Portal</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">Developer Portal</h3>
                <p className="text-muted-foreground text-lg">
                  Build and test integrations with our comprehensive API documentation, sandbox environment, and SDKs.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Interactive API documentation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Sandbox testing environment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Code examples & SDKs</span>
                  </li>
                </ul>
                <Link to="/for-developers">
                  <Button size="lg" className="mt-2">
                    Access Developer API <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Apps Ecosystem Banner - Modern animated cards */}
            <div className="mt-10 p-8 md:p-12 rounded-2xl border bg-card text-center">
              <Smartphone className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-3">Multi-Tenancy App Ecosystem</h3>
              <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                Explore our white-labeled PWA apps — Banking, Merchant & Customer — each branded per institution.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
                {[
                  { label: "Banking App", color: "hsl(217 91% 35%)", icon: Building2 },
                  { label: "Merchant App", color: "hsl(142 76% 36%)", icon: Store },
                  { label: "Customer App", color: "hsl(24 95% 53%)", icon: Users },
                ].map((app, i) => (
                  <motion.div
                    key={app.label}
                    className="flex-1 max-w-[200px] mx-auto rounded-2xl p-6 text-white cursor-pointer select-none"
                    style={{ backgroundColor: app.color }}
                    whileHover={{
                      scale: 1.08,
                      rotate: i === 1 ? -3 : i === 0 ? 3 : -2,
                      y: -8,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  >
                    <app.icon className="h-8 w-8 mx-auto mb-3 opacity-90" strokeWidth={1.8} />
                    <p className="font-semibold text-sm">{app.label}</p>
                  </motion.div>
                ))}
              </div>
              <Link to="/apps">
                <Button size="lg">
                  Explore Apps <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
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
                <div className="mt-6">
                  <Link to="/guides/aisp">
                    <Button size="lg" className="group">
                      Explore AISP
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
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
                <div className="mt-6">
                  <Link to="/guides/pisp">
                    <Button size="lg" variant="outline" className="group border-2">
                      Explore PISP
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
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
                <div className="mt-6">
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
        </div>
      </section>

      {/* CrediQ Credit Score Section */}
      <section className="py-24 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${crediqHeroBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/95 backdrop-blur-sm"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm mb-8">
              <TrendingUp className="h-5 w-5 text-white" />
              <span className="text-sm font-semibold text-white">CrediQ - Cameroon Credit Standard</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Know Your Credit Score
            </h2>
            
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto">
              Get your free credit score in minutes. Build your financial future with personalized recommendations and real-time updates.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all">
                <TrendingUp className="h-12 w-12 text-white mb-4 mx-auto" />
                <h3 className="text-lg font-bold text-white mb-2">Free Forever</h3>
                <p className="text-white/80 text-sm">No hidden fees, always accessible</p>
              </Card>
              
              <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all">
                <Activity className="h-12 w-12 text-white mb-4 mx-auto" />
                <h3 className="text-lg font-bold text-white mb-2">Real-Time Updates</h3>
                <p className="text-white/80 text-sm">Score updates automatically</p>
              </Card>
              
              <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all">
                <Shield className="h-12 w-12 text-white mb-4 mx-auto" />
                <h3 className="text-lg font-bold text-white mb-2">Secure & Private</h3>
                <p className="text-white/80 text-sm">Bank-level security</p>
              </Card>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/crediq/onboarding">
                <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
                  Check Your Score - Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/crediq">
                <Button size="lg" className="text-lg px-10 py-6 bg-crediq-green text-white hover:bg-crediq-green/90 border-0">
                  Learn More
                </Button>
              </Link>
            </div>
            
            <p className="text-sm text-white/70 mt-8">
              ✓ Takes 3 minutes  ✓ No impact on your score  ✓ Trusted by thousands
            </p>
          </div>
        </div>
      </section>

      {/* Piggy Bank, Njangi & Rent Reporting Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-2">
                <PiggyBank className="h-4 w-4 mr-2 inline" />
                Build Credit Your Way
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Savings, Groups & Rent — All Build Your Credit
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Three powerful tools that turn everyday financial habits into credit-building opportunities. 
                Every on-time payment is reported to your CrediQ score.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-primary/20">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <PiggyBank className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Piggy Bank</h3>
                <p className="text-muted-foreground mb-4">
                  Set a savings goal, choose your schedule, and build credit with every on-time payment. +3 to +5 points per payment.
                </p>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Daily, weekly, or monthly</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Goal tracking</li>
                  <li className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Credit score building</li>
                </ul>
                <Link to="/piggybank">
                  <Button className="w-full">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </Link>
              </Card>

              <Card className="p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-accent/20">
                <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Njangi</h3>
                <p className="text-muted-foreground mb-4">
                  The traditional money pot — digitized. Pool funds with friends, take turns receiving, and build credit together.
                </p>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent" /> Random or manual rotation</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent" /> Configurable late interest</li>
                  <li className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent" /> +3 to +5 points per contribution</li>
                </ul>
                <Link to="/njangi">
                  <Button variant="outline" className="w-full">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </Link>
              </Card>

              <Card className="p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-primary/20 bg-gradient-to-br from-background to-muted/20">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Home className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Rent Reporting</h3>
                <p className="text-muted-foreground mb-4">
                  Turn rent payments into credit history with your unique KRENTS reference. +5 to +10 points per payment.
                </p>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Unique KRENTS**** ID</li>
                  <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Direct landlord payments</li>
                  <li className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Highest credit impact</li>
                </ul>
                <Link to="/rent-reporting">
                  <Button className="w-full">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Button>
                </Link>
              </Card>
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
      <section className="py-20 bg-gradient-to-b from-muted/50 via-muted/30 to-background relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple integration process from sandbox to production
            </p>
          </div>
          <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-6 md:gap-4 items-center">
            {/* Step 1 */}
            <Card className="relative p-8 transition-all duration-500 group animate-fade-in border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card hover:from-primary/10 hover:shadow-2xl hover:shadow-primary/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                1
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-primary/20 relative z-10">
                <UserPlus className="h-10 w-10 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-primary relative z-10">Register</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Create your account and complete KYC verification
              </p>
            </Card>

            {/* Arrow 1 */}
            <div className="hidden md:flex items-center justify-center animate-fade-in relative" style={{animationDelay: '0.15s'}}>
              <svg width="40" height="40" viewBox="0 0 40 40" className="curved-arrow text-primary/40">
                <path d="M 5 20 Q 20 10, 35 20" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                <path d="M 35 20 L 30 17 M 35 20 L 30 23" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Step 2 */}
            <Card className="relative p-8 transition-all duration-500 group animate-fade-in border-red-500/30 bg-gradient-to-br from-red-500/5 via-card to-card hover:from-red-500/10 hover:shadow-2xl hover:shadow-red-500/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden" style={{animationDelay: '0.1s'}}>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                2
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-red-500/20 relative z-10">
                <FlaskConical className="h-10 w-10 text-red-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-red-500 relative z-10">Test</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Integrate using our sandbox environment and test APIs
              </p>
            </Card>

            {/* Arrow 2 */}
            <div className="hidden md:flex items-center justify-center animate-fade-in relative" style={{animationDelay: '0.25s'}}>
              <svg width="40" height="40" viewBox="0 0 40 40" className="curved-arrow text-red-500/40">
                <path d="M 5 20 Q 20 10, 35 20" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                <path d="M 35 20 L 30 17 M 35 20 L 30 23" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Step 3 */}
            <Card className="relative p-8 transition-all duration-500 group animate-fade-in border-green-500/30 bg-gradient-to-br from-green-500/5 via-card to-card hover:from-green-500/10 hover:shadow-2xl hover:shadow-green-500/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden" style={{animationDelay: '0.2s'}}>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                3
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-green-500/20 relative z-10">
                <Rocket className="h-10 w-10 text-green-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-green-500 relative z-10">Deploy</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Get production credentials and go live
              </p>
            </Card>

            {/* Arrow 3 */}
            <div className="hidden md:flex items-center justify-center animate-fade-in relative" style={{animationDelay: '0.35s'}}>
              <svg width="40" height="40" viewBox="0 0 40 40" className="curved-arrow text-green-500/40">
                <path d="M 5 20 Q 20 10, 35 20" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                <path d="M 35 20 L 30 17 M 35 20 L 30 23" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Step 4 */}
            <Card className="relative p-8 transition-all duration-500 group animate-fade-in border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-card to-card hover:from-orange-500/10 hover:shadow-2xl hover:shadow-orange-500/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden" style={{animationDelay: '0.3s'}}>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                4
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-orange-500/20 relative z-10">
                <TrendingUp className="h-10 w-10 text-orange-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-orange-500 relative z-10">Scale</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Monitor, optimize, and grow your integration
              </p>
            </Card>
          </div>
          </div>
        </div>
      </section>

      {/* Payment Facilitation Animated Section - NEW */}
      <section className="py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 px-4 py-2">
                <Zap className="h-4 w-4 mr-2 inline" />
                For Developers & Fintechs
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Accept Payments Without Setup Delays
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Use KOB's payment infrastructure to process payments instantly. No KYB delays, no setup fees.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Start in Minutes</h3>
                <p className="text-muted-foreground text-sm">
                  Skip weeks of KYB verification. Start processing payments immediately with our pre-verified account.
                </p>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{animationDelay: '0.1s'}}>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">3.5% + 100 XAF</h3>
                <p className="text-muted-foreground text-sm">
                  Transparent pricing with no setup fees or monthly charges. Only pay for successful transactions.
                </p>
              </Card>

              <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in" style={{animationDelay: '0.2s'}}>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Auto Settlements</h3>
                <p className="text-muted-foreground text-sm">
                  Receive automatic payouts to your bank or mobile money account daily, weekly, or monthly.
                </p>
              </Card>
            </div>

            <div className="text-center">
              <Link to="/payment-facilitation">
                <Button size="lg" className="text-lg px-10 py-6">
                  Learn About Payment Facilitation
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
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

      {/* PostiQ Code Feature Section */}
      <section className="py-20 bg-gradient-to-br from-postiq-red-light/40 via-postiq-red-light/10 to-background border-y border-postiq-red/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 border-postiq-red bg-postiq-red-light">
                <MapPin className="h-4 w-4 inline mr-2 text-postiq-red" />
                New Feature
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                PostiQ Code: UK-Style Locations for Cameroon
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Verify your address with PostiQ Mail and get an instant <strong className="text-crediq-green">+50 point</strong> credit score boost
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Visual Comparison */}
              <Card className="p-6 border-postiq-red/40 bg-gradient-to-br from-postiq-red-light/30 to-background shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 bg-gradient-to-br from-postiq-red to-postiq-red-dark rounded-lg flex items-center justify-center shadow-md">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Better Than what3words</h3>
                    <p className="text-sm text-muted-foreground">Hierarchical UK-style format</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-postiq-red-light to-postiq-red-light/50 rounded-lg border border-postiq-red/20">
                    <div className="text-xs text-muted-foreground mb-1">PostiQ Code</div>
                    <div className="font-mono text-lg font-bold text-postiq-red">YA01 456</div>
                    <div className="text-xs text-muted-foreground mt-1">Yaoundé, Centre Region</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-postiq-red">
                      <CheckCircle className="h-4 w-4" />
                      <span>Structured format</span>
                    </div>
                    <div className="flex items-center gap-2 text-postiq-red">
                      <CheckCircle className="h-4 w-4" />
                      <span>~500m radius</span>
                    </div>
                    <div className="flex items-center gap-2 text-postiq-red">
                      <CheckCircle className="h-4 w-4" />
                      <span>Easy to remember</span>
                    </div>
                    <div className="flex items-center gap-2 text-crediq-green font-semibold">
                      <TrendingUp className="h-4 w-4" />
                      <span>+50 Credit</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Credit Score Impact */}
              <Card className="p-6 border-postiq-red/30 bg-gradient-to-br from-postiq-red-light/20 to-background shadow-lg">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-postiq-red" />
                  Instant Credit Score Boost
                </h3>
                
                <div className="flex items-center justify-between mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-crediq-fair">650</div>
                    <div className="text-xs text-muted-foreground">Before</div>
                  </div>
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-crediq-good">700</div>
                    <div className="text-xs text-muted-foreground">After</div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    <div>
                      <strong>GPS Verification:</strong> Share your location once to get your PostiQ code
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    <div>
                      <strong>Secure & Private:</strong> Your exact coordinates stay private
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    <div>
                      <strong>Rate Limit:</strong> 5 free verifications per day
                    </div>
                  </div>
                </div>

                <Link to="/credit-score" className="block mt-6">
                  <Button className="w-full bg-gradient-to-r from-postiq-red to-postiq-red-dark hover:from-postiq-red-dark hover:to-postiq-red shadow-lg hover:shadow-xl transition-all">
                    <MapPin className="mr-2 h-4 w-4" />
                    Get Your PostiQ Code
                  </Button>
                </Link>
              </Card>
            </div>

            {/* How It Works */}
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="h-16 w-16 bg-gradient-to-br from-postiq-red/20 to-postiq-red-light rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-postiq-red/30">
                  <span className="text-2xl font-bold text-postiq-red">1</span>
                </div>
                <h4 className="font-semibold mb-2">Share Location</h4>
                <p className="text-sm text-muted-foreground">Enable GPS to verify your address</p>
              </div>

              <div className="text-center">
                <div className="h-16 w-16 bg-gradient-to-br from-postiq-red/20 to-postiq-red-light rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-postiq-red/30">
                  <span className="text-2xl font-bold text-postiq-red">2</span>
                </div>
                <h4 className="font-semibold mb-2">Get PostiQ Code</h4>
                <p className="text-sm text-muted-foreground">Receive UK-style location code (YA01 456)</p>
              </div>

              <div className="text-center">
                <div className="h-16 w-16 bg-gradient-to-br from-crediq-green/20 to-crediq-green/10 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-crediq-green/30">
                  <span className="text-2xl font-bold text-crediq-green">3</span>
                </div>
                <h4 className="font-semibold mb-2">Score Increases</h4>
                <p className="text-sm text-muted-foreground">+50 points added automatically</p>
              </div>
            </div>

            <div className="text-center mt-8">
              <Link to="/credit-scores-info" className="text-sm text-primary hover:underline">
                Learn more about PostiQ and credit scoring →
              </Link>
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
      <section className="py-20 relative overflow-hidden text-primary-foreground">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${crediqHeroBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/85 to-primary/95 backdrop-blur-sm"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10">
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
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Contact Sales
              </Button>
            </Link>
          </div>
          </div>
        </div>
      </section>
      <ProductTour />
    </div>
  );
};

export default Index;
