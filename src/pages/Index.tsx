import { SEO } from "@/components/SEO";
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
import ecoBankingOps from "@/assets/eco-banking-ops.jpg";
import ecoHomeCover from "@/assets/eco-home-cover.png";
import ecoFintechSolutions from "@/assets/eco-fintech-solutions.jpg";
import { SmartGetStartedButton } from "@/components/SmartGetStartedButton";
import { ProductTour } from "@/components/ProductTour";
import { HomepageHeroSlider } from "@/components/HomepageHeroSlider";
import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CodeImageFlipCard } from "@/components/CodeImageFlipCard";
import { AccountsPreview, PaymentsPreview, CreditScorePreview, SavingsPreview } from "@/components/AnimatedPreviews";

const Index = () => {
  return (
    <div className="min-h-screen">
      <SEO
        title="Unified Open Banking API for Cameroon"
        description="Connect banks, credit unions, and fintech companies with Cameroon's #1 Open Banking platform. XAF-native payments, credit scoring, and merchant tools."
        canonical="https://kangopenbanking.com"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Kang Open Banking",
          "url": "https://kangopenbanking.com",
          "logo": "https://kangopenbanking.com/kob-logo.png",
          "description": "Unified Open Banking API for Cameroon's financial ecosystem",
          "sameAs": [],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Support",
            "email": "support@kangopenbanking.com"
          }
        }}
      />
      <HomepageHeroSlider fallback={
        <section className="relative overflow-hidden animated-gradient-banner">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent"></div>
          <div className="container mx-auto px-4 py-24 md:py-40 relative">
            <div className="max-w-5xl mx-auto text-center">
              <div className="space-y-8 animate-fade-in">
                <Badge variant="outline" className="px-6 py-2 text-sm font-medium border-white/30 bg-white/90 text-blue-900">
                  <Globe className="h-4 w-4 inline mr-2" />
                  Cameroon's #1 Open Banking Platform
                </Badge>
                <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">
                  One API for Banking, Payments &amp; Credit
                </h1>
                <p className="text-xl md:text-2xl text-white/95 drop-shadow-md font-medium leading-relaxed max-w-3xl mx-auto">
                  Connect to every bank, mobile money provider, and fintech in Cameroon — through a single, XAF-native Open Banking API.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <SmartGetStartedButton size="lg" className="text-lg px-10 py-6 shadow-lg hover:shadow-xl transition-shadow" />
                  <Link to="/documentation">
                    <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-2 bg-white/95 hover:bg-white text-blue-900 border-white/30">
                      Read the Docs
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
                    <span className="text-sm font-semibold text-blue-900">Designed for COBAC alignment</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 border border-white/30">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-900">PCI-DSS scope via tokenisation partner</span>
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
              <Badge variant="outline" className="mb-4">Portals &amp; Apps</Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Built for Every Role in the Ecosystem
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Purpose-built portals for banks, merchants, and developers — plus white-labeled apps ready to deploy.
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
                    Explore merchant features <ArrowRight className="ml-2 h-4 w-4" />
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
            <div className="mt-10 p-8 md:p-12 rounded-2xl border bg-card">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Left - Text Content */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8 text-primary" />
                    <Badge variant="outline" className="px-3 py-1">PWA Ecosystem</Badge>
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold leading-tight">Multi-Tenancy App Ecosystem</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Explore our white-labeled PWA apps — Banking, Merchant & Customer — each branded per institution, ready for deployment.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "White-labeled per institution",
                      "Offline-first PWA architecture",
                      "Role-based access control",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3 text-muted-foreground">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/apps">
                    <Button size="lg" className="mt-2">
                      Explore Apps <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                {/* Right - Stacked Cards */}
                <div className="relative flex items-center justify-center min-h-[420px]">
                  {[
                    { label: "Customer App", subtitle: "Personal Banking", desc: "Send money, pay bills, manage accounts — all from your phone.", icon: Users, color: "hsl(24 95% 53%)", bg: ecoBankingOps, features: ["Mobile Payments", "Bill Pay", "Account Management"], rotate: 6, z: 1, x: 16, y: 8 },
                    { label: "Merchant App", subtitle: "Business Tools", desc: "Accept payments, track sales, manage inventory in real-time.", icon: Store, color: "hsl(142 76% 36%)", bg: ecoFintechSolutions, features: ["POS Integration", "Sales Analytics", "Inventory Sync"], rotate: 3, z: 2, x: 8, y: 4 },
                    { label: "Banking App", subtitle: "Core Operations", desc: "Full banking operations — accounts, loans, KYC, and compliance.", icon: Building2, color: "hsl(217 91% 35%)", bg: ecoHomeCover, features: ["Account Ops", "Loan Management", "KYC & Compliance"], rotate: 0, z: 3, x: 0, y: 0 },
                  ].map((app, i) => (
                    <motion.div
                      key={app.label}
                      className="absolute cursor-pointer select-none"
                      style={{ zIndex: app.z }}
                      initial={{ rotate: app.rotate, x: app.x, y: app.y }}
                      whileHover={{
                        scale: 1.06,
                        rotate: 0,
                        x: 0,
                        y: -16,
                        zIndex: 10,
                      }}
                      transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    >
                      <div
                        className="w-[260px] h-[380px] rounded-3xl text-white flex flex-col shadow-2xl border border-white/10 overflow-hidden relative"
                        style={{
                          boxShadow: `0 25px 60px -15px ${app.color.replace(')', ' / 0.3)')}`,
                        }}
                      >
                        {/* Background Image */}
                        <div className="absolute inset-0">
                          <img src={app.bg} alt={app.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 p-6 flex flex-col h-full">
                          {/* Card Header */}
                          <div className="mb-auto">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: app.color }}>
                              <app.icon className="h-5 w-5 text-white" strokeWidth={2} />
                            </div>
                            <h4 className="text-2xl font-bold tracking-tight">{app.label}</h4>
                            <p className="text-sm text-white/60 mt-1">{app.subtitle}</p>
                          </div>

                          {/* Card Bottom */}
                          <div className="mt-auto">
                            <p className="text-xs text-white/70 mb-3 leading-relaxed">{app.desc}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {app.features.map((feat) => (
                                <span key={feat} className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/80 backdrop-blur-sm">
                                  {feat}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
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
                      <p className="text-sm text-muted-foreground">Consent-driven data sharing designed for COBAC alignment</p>
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
                imageAlt="Banking Account Aggregation Dashboard"
                previewContent={<AccountsPreview />}
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
              <div className="md:order-1">
              <CodeImageFlipCard
                endpoint="POST /v1/payments"
                imageAlt="Mobile Money Payment Processing"
                previewContent={<PaymentsPreview />}
                code={`{
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
              />
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
                      <p className="text-sm text-muted-foreground">Reporting workflows designed against COBAC reporting templates</p>
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
              <CodeImageFlipCard
                endpoint="POST /v1/loans/apply"
                imageAlt="Loan & Credit Scoring Dashboard"
                previewContent={<CreditScorePreview />}
                code={`{
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
              />
            </div>
          </div>
          </ScrollReveal>

          {/* Savings Section */}
          <ScrollReveal direction="right">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="md:order-1">
              <CodeImageFlipCard
                endpoint="POST /v1/savings/goals"
                imageAlt="Smart Savings Goal Tracker"
                previewContent={<SavingsPreview />}
                code={`{
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
              />
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
                  Learn how CrediQ scoring works
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
                  <Link to={card.link} aria-label={`Learn more about ${card.title}`}>
                    <Button variant={card.variant} className="w-full">Explore {card.title} <ArrowRight className="ml-2 h-4 w-4" /></Button>
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
              { icon: Shield, title: "Strong Transport Security", desc: "TLS 1.3 in transit and AES-256 at rest, with 24/7 monitoring. Card data is handled via our tokenisation partner so KOB stays out of PCI SAQ-D scope." },
              { icon: Lock, title: "Designed for COBAC & BEAC", desc: "Built against COBAC and BEAC requirements with audit trails and reporting templates. Licensing is in progress; no certification is claimed." },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6">
            {[
              { step: 1, icon: UserPlus, title: "Register", desc: "Create your account and complete KYC verification", bg: "hsl(var(--primary))", text: "hsl(var(--primary-foreground))", rotate: "-3deg", translateY: "0px" },
              { step: 2, icon: FlaskConical, title: "Test", desc: "Integrate using our sandbox environment and test APIs", bg: "hsl(var(--destructive))", text: "hsl(var(--destructive-foreground))", rotate: "2deg", translateY: "12px" },
              { step: 3, icon: Rocket, title: "Deploy", desc: "Get production credentials and go live", bg: "hsl(30, 90%, 50%)", text: "hsl(0, 0%, 100%)", rotate: "-2deg", translateY: "4px" },
              { step: 4, icon: TrendingUp, title: "Scale", desc: "Monitor, optimize, and grow your integration", bg: "hsl(var(--accent))", text: "hsl(var(--accent-foreground))", rotate: "3deg", translateY: "16px" },
            ].map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 0.12}>
                <motion.div
                  whileHover={{ rotate: "0deg", translateY: "-8px", scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ rotate: item.rotate, translateY: item.translateY }}
                >
                  <div
                    className="relative rounded-3xl p-8 shadow-xl cursor-default overflow-hidden group"
                    style={{ backgroundColor: item.bg, color: item.text }}
                  >
                    {/* Decorative circle */}
                    <div
                      className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
                      style={{ backgroundColor: item.text }}
                    />
                    {/* Step number */}
                    <div
                      className="absolute top-4 right-4 w-10 h-10 rounded-full font-bold flex items-center justify-center text-base shadow-lg"
                      style={{ backgroundColor: `${item.text}`, color: item.bg }}
                    >
                      {item.step}
                    </div>
                    {/* Icon */}
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-500"
                      style={{ backgroundColor: `color-mix(in srgb, ${item.text} 20%, transparent)` }}
                    >
                      <item.icon className="h-8 w-8" style={{ color: item.text }} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: item.text }}>{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: `color-mix(in srgb, ${item.text} 80%, transparent)` }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              </ScrollReveal>
            ))}
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
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-blue-500 hover:bg-primary-foreground hover:text-primary">
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
