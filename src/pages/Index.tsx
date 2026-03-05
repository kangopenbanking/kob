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
import paymentVisa from "@/assets/payment-visa.png";
import paymentMastercard from "@/assets/payment-mastercard.png";
import paymentMtn from "@/assets/payment-mtn.png";
import paymentPaypal from "@/assets/payment-paypal.png";
import paymentOrange from "@/assets/payment-orange.png";
import paymentBank from "@/assets/payment-bank.png";
import { SmartGetStartedButton } from "@/components/SmartGetStartedButton";
import { ProductTour } from "@/components/ProductTour";
import { HomepageHeroSlider } from "@/components/HomepageHeroSlider";
import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CodeImageFlipCard } from "@/components/CodeImageFlipCard";
import apiAccountsPreview from "@/assets/api-accounts-preview.jpg";
import apiPaymentsPreview from "@/assets/api-payments-preview.jpg";
import apiLoansPreview from "@/assets/api-loans-preview.jpg";
import apiSavingsPreview from "@/assets/api-savings-preview.jpg";

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

      {/* Payment Systems Marquee */}
      <section className="py-6 bg-background overflow-hidden border-b border-border/40">
        <div className="relative marquee-container">
          <div className="marquee-track">
            {[...Array(3)].map((_, setIdx) => (
              <div key={setIdx} className="flex gap-16 items-center shrink-0 px-8">
                {[paymentVisa, paymentMastercard, paymentMtn, paymentOrange, paymentPaypal, paymentBank].map((logo, i) => (
                  <img key={`${setIdx}-${i}`} src={logo} alt="Payment partner" className="h-10 md:h-12 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Access Section */}
      <ScrollReveal>
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
            <ScrollReveal direction="left">
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
            </ScrollReveal>

            {/* Portal 2 - Merchant Portal - Image Right */}
            <ScrollReveal direction="right">
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
            </ScrollReveal>

            {/* Portal 3 - Developer Portal - Image Left */}
            <ScrollReveal direction="left">
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
            </ScrollReveal>

            {/* Apps Ecosystem Banner - Modern animated cards */}
            <ScrollReveal>
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
            </ScrollReveal>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* Stats Section */}
      <ScrollReveal>
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent"></div>
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center text-primary-foreground">
            {[
              { value: "25+", label: "Financial Institutions" },
              { value: "99.9%", label: "Uptime Guarantee" },
              { value: "<200ms", label: "Avg Response Time" },
              { value: "1M+", label: "API Calls Daily" },
            ].map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 0.1} direction="up">
              <div className="space-y-3">
                <div className="text-5xl md:text-6xl font-bold mb-2 tracking-tight">{stat.value}</div>
                <div className="text-sm md:text-base opacity-90 font-medium">{stat.label}</div>
                <div className="h-1 w-16 bg-primary-foreground/30 mx-auto rounded-full"></div>
              </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* Core APIs Section */}
      <ScrollReveal>
      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Database className="h-4 w-4 mr-2 inline" />
              Core Product Suite
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Everything You Need to Build Financial Products
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              From account data to payment processing — complete tools for the CEMAC financial ecosystem
            </p>
          </div>

          {/* Open Banking API */}
          <ScrollReveal direction="left">
          <div className="mb-24 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <Database className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">Open Banking API</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Unified Account Access
                </h3>
                <p className="text-lg text-muted-foreground">
                  Connect to any bank account in the CEMAC region. Read balances, transactions, 
                  and account details with a single API integration.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Multi-Bank Aggregation</h4>
                      <p className="text-sm text-muted-foreground">Connect to 25+ banks and credit unions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Real-Time Data</h4>
                      <p className="text-sm text-muted-foreground">Instant balance checks and transaction history</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Consent-Based Access</h4>
                      <p className="text-sm text-muted-foreground">COBAC-compliant data sharing with user consent</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Link to="/developer/api/accounts">
                    <Button size="lg" className="group">
                      Explore Account APIs
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </div>
              <CodeImageFlipCard
                endpoint="GET /v1/accounts"
                image={apiAccountsPreview}
                imageAlt="Banking Account Aggregation Dashboard"
                code={`{
  "accounts": [{
    "id": "acc_cm_123",
    "institution": "Afriland First Bank",
    "type": "savings",
    "balance": {
      "amount": 2450000,
      "currency": "XAF"
    },
    "holder": "Jean-Paul Nkomo",
    "rib": {
      "bank_code": "10005",
      "branch_code": "00001",
      "account_number": "12345678901",
      "key": "23"
    }
  }]
}`}
              />
            </div>
          </div>
          </ScrollReveal>

          {/* Payment Processing */}
          <ScrollReveal direction="right">
          <div className="mb-24 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="bg-card border rounded-2xl p-6 shadow-lg md:order-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive"></div>
                  <div className="w-3 h-3 rounded-full bg-accent"></div>
                  <div className="w-3 h-3 rounded-full bg-secondary"></div>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">POST /v1/payments</span>
                </div>
                <pre className="text-xs md:text-sm text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "payment": {
    "id": "pay_momo_456",
    "method": "mobile_money",
    "provider": "mtn_cm",
    "amount": 15000,
    "currency": "XAF",
    "status": "completed",
    "recipient": "+237677123456",
    "reference": "INV-2025-001",
    "fees": {
      "platform": 525,
      "provider": 0
    }
  }
}`}
                </pre>
              </div>
              <div className="space-y-6 md:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20">
                  <CreditCard className="h-5 w-5 text-secondary" />
                  <span className="text-sm font-semibold text-secondary">Payment Processing</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Accept Every Payment Method
                </h3>
                <p className="text-lg text-muted-foreground">
                  Mobile money, cards, and bank transfers — all through a unified payment API 
                  with automatic reconciliation and settlement.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Smartphone className="h-4 w-4 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Mobile Money</h4>
                      <p className="text-sm text-muted-foreground">MTN MoMo, Orange Money with USSD push</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-4 w-4 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Card Payments</h4>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard with 3D Secure</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Bank Transfers</h4>
                      <p className="text-sm text-muted-foreground">Direct bank-to-bank across CEMAC</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Link to="/developer/gateway/charges">
                    <Button size="lg" variant="outline" className="group border-2">
                      Payment API Docs
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          </ScrollReveal>

          {/* Loans & Credit Section */}
          <ScrollReveal direction="left">
          <div className="mb-24 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                  <PieChart className="h-5 w-5 text-accent" />
                  <span className="text-sm font-semibold text-accent">Loans & Credit</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Digital Lending Infrastructure
                </h3>
                <p className="text-lg text-muted-foreground">
                  Complete loan origination, credit scoring (300-850), and repayment management 
                  with automated decisioning and regulatory compliance.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Credit Scoring</h4>
                      <p className="text-sm text-muted-foreground">300-850 CrediQ score based on financial behavior</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Instant Decisioning</h4>
                      <p className="text-sm text-muted-foreground">Automated loan approval in under 60 seconds</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Regulatory Reporting</h4>
                      <p className="text-sm text-muted-foreground">Automated COBAC compliance and reporting</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Link to="/loans">
                    <Button size="lg" variant="outline" className="group border-2">
                      Explore Lending APIs
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="bg-card border rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive"></div>
                  <div className="w-3 h-3 rounded-full bg-accent"></div>
                  <div className="w-3 h-3 rounded-full bg-secondary"></div>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">POST /v1/loans/apply</span>
                </div>
                <pre className="text-xs md:text-sm text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "loan": {
    "id": "loan_789",
    "applicant": "Jean-Paul Nkomo",
    "amount": 500000,
    "currency": "XAF",
    "term_months": 12,
    "interest_rate": 8.5,
    "credit_score": 720,
    "status": "approved",
    "monthly_payment": 43750,
    "decision_time_ms": 1200
  }
}`}
                </pre>
              </div>
            </div>
          </div>
          </ScrollReveal>

          {/* Savings Section */}
          <ScrollReveal direction="right">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="bg-card border rounded-2xl p-6 shadow-lg md:order-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive"></div>
                  <div className="w-3 h-3 rounded-full bg-accent"></div>
                  <div className="w-3 h-3 rounded-full bg-secondary"></div>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">POST /v1/savings/goals</span>
                </div>
                <pre className="text-xs md:text-sm text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap">
{`{
  "savings_goal": {
    "id": "sav_101",
    "name": "Emergency Fund",
    "target_amount": 1000000,
    "current_amount": 350000,
    "currency": "XAF",
    "frequency": "monthly",
    "auto_debit": true,
    "interest_rate": 3.5,
    "progress": 35,
    "credit_impact": "+5 per payment",
    "next_debit": "2025-03-01"
  }
}`}
                </pre>
              </div>
              <div className="space-y-6 md:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">Savings & Goals</span>
                </div>
                <h3 className="text-3xl md:text-4xl font-bold">
                  Smart Savings Infrastructure
                </h3>
                <p className="text-lg text-muted-foreground">
                  Programmable savings goals with auto-debit, interest calculation, 
                  and credit score integration for every on-time contribution.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <PiggyBank className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Goal-Based Savings</h4>
                      <p className="text-sm text-muted-foreground">Set targets with automated recurring deposits</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Credit Building</h4>
                      <p className="text-sm text-muted-foreground">+3 to +5 CrediQ points per on-time payment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Njangi Groups</h4>
                      <p className="text-sm text-muted-foreground">Digital rotating savings with group management</p>
                    </div>
                  </div>
                </div>
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
          </ScrollReveal>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* CrediQ Credit Score Section */}
      <ScrollReveal>
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
              {[
                { icon: TrendingUp, title: "Free Forever", desc: "No hidden fees, always accessible" },
                { icon: Activity, title: "Real-Time Updates", desc: "Score updates automatically" },
                { icon: Shield, title: "Secure & Private", desc: "Bank-level security" },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.15} direction="up">
                <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all">
                  <item.icon className="h-12 w-12 text-white mb-4 mx-auto" />
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-white/80 text-sm">{item.desc}</p>
                </Card>
                </ScrollReveal>
              ))}
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
      </ScrollReveal>

      {/* Piggy Bank, Njangi & Rent Reporting Section */}
      <ScrollReveal>
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
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
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: PiggyBank,
                  title: "Piggy Bank",
                  desc: "Set a savings goal, choose your schedule, and build credit with every on-time payment. +3 to +5 points per payment.",
                  features: ["Daily, weekly, or monthly", "Goal tracking", "Credit score building"],
                  link: "/piggybank",
                  color: "primary" as const,
                  variant: "default" as const,
                },
                {
                  icon: Users,
                  title: "Njangi",
                  desc: "The traditional money pot — digitized. Pool funds with friends, take turns receiving, and build credit together.",
                  features: ["Random or manual rotation", "Configurable late interest", "+3 to +5 points per contribution"],
                  link: "/njangi",
                  color: "accent" as const,
                  variant: "outline" as const,
                },
                {
                  icon: Home,
                  title: "Rent Reporting",
                  desc: "Turn rent payments into credit history with your unique KRENTS reference. +5 to +10 points per payment.",
                  features: ["Unique KRENTS**** ID", "Direct landlord payments", "Highest credit impact"],
                  link: "/rent-reporting",
                  color: "primary" as const,
                  variant: "default" as const,
                },
              ].map((card, i) => (
                <ScrollReveal key={card.title} delay={i * 0.12} direction="up">
                <Card className="p-8 hover:shadow-xl transition-all hover:-translate-y-1 border-primary/20">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <card.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
                  <p className="text-muted-foreground mb-4">{card.desc}</p>
                  <ul className="space-y-2 text-sm mb-6">
                    {card.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to={card.link}>
                    <Button variant={card.variant} className="w-full">Learn More <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  </Link>
                </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* Security & Compliance Section */}
      <ScrollReveal>
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <ScrollReveal>
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Enterprise Security</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Bank-Grade Security & Compliance
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your data is protected with military-grade encryption and compliance with international standards
            </p>
          </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { icon: Shield, title: "Bank-Grade Security", desc: "TLS 1.3 encryption, AES-256 at rest, PCI-DSS Level 1 certified with 24/7 monitoring." },
              { icon: Lock, title: "Regulatory Compliant", desc: "Full COBAC & BEAC compliance with automated reporting and comprehensive audit trails." },
              { icon: Globe, title: "CEMAC Coverage", desc: "Access banks and mobile money across Cameroon and the Central African region." },
              { icon: Clock, title: "Real-Time Data", desc: "Instant account balances, transactions, and payment status updates in real-time." },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.1} direction="up">
              <Card className="p-6 hover:shadow-lg transition-shadow group">
                <item.icon className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </Card>
              </ScrollReveal>
            ))}
          </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* How It Works */}
      <ScrollReveal>
      <section className="py-20 bg-gradient-to-b from-muted/50 via-muted/30 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
          <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple integration process from sandbox to production
            </p>
          </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-6 md:gap-4 items-center">
            {/* Step 1 */}
            <ScrollReveal delay={0}>
            <Card className="relative p-8 transition-all duration-500 group border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card hover:from-primary/10 hover:shadow-2xl hover:shadow-primary/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden">
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
            </ScrollReveal>

            <div className="hidden md:flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" className="text-primary/40">
                <path d="M 5 20 Q 20 10, 35 20" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                <path d="M 35 20 L 30 17 M 35 20 L 30 23" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Step 2 */}
            <ScrollReveal delay={0.15}>
            <Card className="relative p-8 transition-all duration-500 group border-destructive/30 bg-gradient-to-br from-destructive/5 via-card to-card hover:from-destructive/10 hover:shadow-2xl hover:shadow-destructive/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-destructive to-destructive/60 text-destructive-foreground font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                2
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-destructive/20 relative z-10">
                <FlaskConical className="h-10 w-10 text-destructive" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-destructive relative z-10">Test</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Integrate using our sandbox environment and test APIs
              </p>
            </Card>
            </ScrollReveal>

            <div className="hidden md:flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" className="text-destructive/40">
                <path d="M 5 20 Q 20 10, 35 20" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                <path d="M 35 20 L 30 17 M 35 20 L 30 23" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Step 3 */}
            <ScrollReveal delay={0.3}>
            <Card className="relative p-8 transition-all duration-500 group border-secondary/30 bg-gradient-to-br from-secondary/5 via-card to-card hover:from-secondary/10 hover:shadow-2xl hover:shadow-secondary/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/60 text-secondary-foreground font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                3
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-secondary/20 relative z-10">
                <Rocket className="h-10 w-10 text-secondary" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-secondary relative z-10">Deploy</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Get production credentials and go live
              </p>
            </Card>
            </ScrollReveal>

            <div className="hidden md:flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" className="text-secondary/40">
                <path d="M 5 20 Q 20 10, 35 20" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                <path d="M 35 20 L 30 17 M 35 20 L 30 23" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </div>

            {/* Step 4 */}
            <ScrollReveal delay={0.45}>
            <Card className="relative p-8 transition-all duration-500 group border-accent/30 bg-gradient-to-br from-accent/5 via-card to-card hover:from-accent/10 hover:shadow-2xl hover:shadow-accent/20 hover:scale-105 hover:-translate-y-1 backdrop-blur-sm card-3d overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent/60 text-accent-foreground font-bold flex items-center justify-center text-base shadow-lg relative z-10">
                4
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-accent/20 relative z-10">
                <TrendingUp className="h-10 w-10 text-accent" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-accent relative z-10">Scale</h3>
              <p className="text-sm text-muted-foreground relative z-10">
                Monitor, optimize, and grow your integration
              </p>
            </Card>
            </ScrollReveal>
          </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* Payment Facilitation Animated Section */}
      <ScrollReveal>
      <section className="py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
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
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {[
                { icon: Zap, title: "Start in Minutes", desc: "Skip weeks of KYB verification. Start processing payments immediately with our pre-verified account." },
                { icon: DollarSign, title: "3.5% + 100 XAF", desc: "Transparent pricing with no setup fees or monthly charges. Only pay for successful transactions." },
                { icon: Wallet, title: "Auto Settlements", desc: "Receive automatic payouts to your bank or mobile money account daily, weekly, or monthly." },
              ].map((item, i) => (
                <ScrollReveal key={item.title} delay={i * 0.1} direction="up">
                <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </Card>
                </ScrollReveal>
              ))}
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
      </ScrollReveal>

      {/* Use Cases */}
      <ScrollReveal>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
          <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powering Innovation Across Fintech
            </h2>
          </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { icon: Users, title: "Account Aggregation", desc: "Build personal finance apps that aggregate accounts from multiple banks for a unified view.", link: null },
              { icon: Zap, title: "Payment Initiation", desc: "Enable instant payments and transfers directly from users' bank accounts.", link: null },
              { icon: TrendingUp, title: "Lending Platforms", desc: "Access transaction data for credit scoring and automated loan decisioning with 300-850 scoring.", link: "/credit-scores-info" },
              { icon: FileText, title: "Business Tools", desc: "Build accounting, invoicing, and reconciliation tools for businesses.", link: null },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.1} direction={i % 2 === 0 ? "left" : "right"}>
              <Card className="p-6">
                <item.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
                {item.link && (
                  <Link to={item.link} className="text-sm text-primary hover:underline mt-2 inline-block">
                    Learn about Credit Scoring →
                  </Link>
                )}
              </Card>
              </ScrollReveal>
            ))}
          </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* PostiQ Code Feature Section */}
      <ScrollReveal>
      <section className="py-20 bg-gradient-to-br from-postiq-red-light/40 via-postiq-red-light/10 to-background border-y border-postiq-red/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
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
            </ScrollReveal>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <ScrollReveal direction="left">
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
              </ScrollReveal>

              <ScrollReveal direction="right">
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
              </ScrollReveal>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { num: "1", title: "Share Location", desc: "Enable GPS to verify your address", color: "postiq-red" },
                { num: "2", title: "Get PostiQ Code", desc: "Receive UK-style location code (YA01 456)", color: "postiq-red" },
                { num: "3", title: "Score Increases", desc: "+50 points added automatically", color: "crediq-green" },
              ].map((step, i) => (
                <ScrollReveal key={step.num} delay={i * 0.12} direction="up">
                <div className="text-center">
                  <div className={`h-16 w-16 bg-gradient-to-br from-${step.color}/20 to-${step.color}/10 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-${step.color}/30`}>
                    <span className={`text-2xl font-bold text-${step.color}`}>{step.num}</span>
                  </div>
                  <h4 className="font-semibold mb-2">{step.title}</h4>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
                </ScrollReveal>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link to="/credit-scores-info" className="text-sm text-primary hover:underline">
                Learn more about PostiQ and credit scoring →
              </Link>
            </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* Partners */}
      <ScrollReveal>
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
      </ScrollReveal>

      {/* CTA Section */}
      <ScrollReveal>
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
      </ScrollReveal>
      <ProductTour />
    </div>
  );
};

export default Index;
