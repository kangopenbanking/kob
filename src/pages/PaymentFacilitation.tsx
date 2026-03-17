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
  Code2,
  BarChart3,
  Layers,
} from "lucide-react";
import { SmartGetStartedButton } from "@/components/SmartGetStartedButton";
import { motion } from "framer-motion";
import pfBanner from "@/assets/payment-facilitation-banner.png";
import pfIntegrationGrid from "@/assets/pf-integration-grid.png";
import pfPayByBank from "@/assets/pf-pay-by-bank.png";
import pfCommerce from "@/assets/pf-commerce-2026.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const PaymentFacilitation = () => {
  return (
    <div className="min-h-screen">
      {/* ═══ Hero Section with Banner ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={pfBanner} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </div>
        <div className="container mx-auto px-4 relative py-28 md:py-36">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-6 px-4 py-2 bg-background/60 backdrop-blur-sm border-primary/30">
                <Zap className="h-4 w-4 mr-2 inline text-primary" />
                White-Label Payment Processing
              </Badge>
            </motion.div>
            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              Accept Payments
              <br />
              <span className="text-primary">Instantly</span>
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Start processing mobile money and bank transfers immediately using KOB's infrastructure.
              No KYB delays, no setup fees — just instant payment processing.
            </motion.p>
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <SmartGetStartedButton size="lg" className="text-lg px-10 py-6" />
              <Link to="/developer/payment-facilitation">
                <Button size="lg" variant="outline" className="text-lg px-10 py-6 bg-background/60 backdrop-blur-sm">
                  View API Docs
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ Stats Bar ═══ */}
      <section className="border-b border-border/50 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-border/50">
            {[
              { value: "Low", label: "Transaction Fees", icon: DollarSign },
              { value: "0 min", label: "Setup Time", icon: Clock },
              { value: "24/7", label: "Processing", icon: Zap },
              { value: "$0", label: "Monthly Fees", icon: Shield },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                className="flex items-center gap-3 py-6 px-4 md:px-6 justify-center"
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Four Steps to Get Paid
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From registration to receiving settlements — it's that simple
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-20 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            {[
              { step: 1, title: "Register", desc: "Sign up and enable KOB facilitation", icon: Users },
              { step: 2, title: "Configure", desc: "Set up your settlement account", icon: Building2 },
              { step: 3, title: "Process", desc: "Collect payments via our API", icon: CreditCard },
              { step: 4, title: "Get Settled", desc: "Receive automatic settlements", icon: Wallet },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative"
              >
                <div className="mb-5 flex justify-center">
                  <div className="relative w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-lg">
                    {s.step}
                    <div className="absolute -inset-1 rounded-2xl bg-primary/20 animate-pulse" />
                  </div>
                </div>
                <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-4">
                      <s.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Integration Showcase with Image ═══ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-4">Flexible Integration</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Build With Confidence
              </h2>
              <p className="text-muted-foreground mb-6">
                Plug our payment API into any platform. From e-commerce to SaaS, our modular endpoints
                let you mix and match exactly what you need.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Code2, title: "RESTful API", desc: "Clean, well-documented endpoints for every use case" },
                  { icon: Layers, title: "Modular Design", desc: "Use only what you need — charges, transfers, or both" },
                  { icon: Shield, title: "Secure by Default", desc: "PCI-DSS compliant with bank-level encryption" },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{f.title}</p>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/developer/payment-facilitation">
                <Button className="mt-6" variant="outline">
                  Explore API Docs <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-border/40">
                <img src={pfIntegrationGrid} alt="Modular payment integration" className="w-full h-auto" />
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/10 rounded-3xl -z-10" />
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-primary/5 rounded-2xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ Benefits ═══ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose Payment Facilitation?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Skip the complexity and start accepting payments today
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap, title: "Instant Activation",
                items: ["No payment account setup needed", "Skip lengthy KYB verification", "Start processing in minutes", "Use our pre-verified account"],
              },
              {
                icon: DollarSign, title: "Simple Pricing",
                items: ["Only 3.5% + 100 XAF per transaction", "No setup fees or monthly charges", "Free settlement transfers", "Volume discounts available"],
              },
              {
                icon: Clock, title: "Automated Settlements",
                items: ["Daily, weekly, or monthly", "Direct to bank or mobile money", "Transparent fee deduction", "Real-time balance tracking"],
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <Card className="h-full border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                  <CardContent className="pt-8 pb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                      <card.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-4">{card.title}</h3>
                    <ul className="space-y-3 text-muted-foreground">
                      {card.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Pay by Bank Visual Section ═══ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 md:order-1"
            >
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-border/40">
                <img src={pfPayByBank} alt="Pay by Bank growth" className="w-full h-auto" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 md:order-2"
            >
              <Badge variant="outline" className="mb-4">Growing Fast</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Pay by Bank is the Future
              </h2>
              <p className="text-muted-foreground mb-6">
                Bank transfers and mobile money are growing rapidly across Central Africa.
                Position your business to capture this growth with KOB's payment infrastructure.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "3.5%", label: "Facilitation fee" },
                  { value: "T+1", label: "Settlement speed" },
                  { value: "MTN/Orange", label: "MoMo supported" },
                  { value: "CEMAC", label: "Bank coverage" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-background rounded-2xl border border-border/50 p-4 text-center">
                    <p className="text-xl font-bold text-primary">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ Use Cases with Image ═══ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ideal for developers and fintechs building payment solutions
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            {/* Commerce image card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="md:row-span-2"
            >
              <div className="rounded-3xl overflow-hidden border border-border/50 h-full relative group">
                <img src={pfCommerce} alt="Commerce 2026" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <Badge className="mb-2 bg-primary/90">Commerce 2026</Badge>
                  <p className="text-sm text-foreground font-medium">
                    The future of payments in Central Africa — verified, secure, and instant.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Developer card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full border-border/50 hover:shadow-lg transition-all">
                <CardContent className="pt-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <Smartphone className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Developers</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Building apps that need payments in Cameroon
                  </p>
                  <ul className="space-y-2 text-sm">
                    {["E-commerce platforms", "Subscription services", "Mobile applications", "Marketplace solutions"].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Fintech card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full border-border/50 hover:shadow-lg transition-all">
                <CardContent className="pt-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Fintechs</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Launching payment products quickly
                  </p>
                  <ul className="space-y-2 text-sm">
                    {["Digital wallets", "P2P payment platforms", "Bill payment services", "Remittance solutions"].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ Comparison ═══ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Traditional vs Facilitation
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See why payment facilitation is faster and easier
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-border/50">
                <CardContent className="pt-8">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Traditional Approach</h3>
                    <Badge variant="destructive">Slow & Complex</Badge>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { title: "2-4 weeks setup time", desc: "Complete KYB verification" },
                      { title: "Complex documentation", desc: "Business registration, tax documents" },
                      { title: "Manual settlements", desc: "Track and request payouts" },
                      { title: "Higher complexity", desc: "Manage provider relationships" },
                    ].map((item) => (
                      <li key={item.title} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-destructive text-xs font-bold">✗</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-primary/50 shadow-lg ring-1 ring-primary/10">
                <CardContent className="pt-8">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">Payment Facilitation</h3>
                    <Badge className="bg-primary">Fast & Simple</Badge>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { title: "Instant activation", desc: "Start in minutes" },
                      { title: "Simple onboarding", desc: "Just settlement account details" },
                      { title: "Automated settlements", desc: "Daily, weekly, or monthly" },
                      { title: "Zero complexity", desc: "We handle everything" },
                    ].map((item) => (
                      <li key={item.title} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ Settlement Flow ═══ */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Settlement Flow</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Understand how your money flows from customer to your account
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <Card className="border-border/50">
              <CardContent className="p-8 space-y-1">
                {[
                  { icon: DollarSign, title: "Customer Payment", desc: "Money collected through KOB's gateway via mobile money or bank transfer." },
                  { icon: BarChart3, title: "Automatic Tracking", desc: "KOB tracks all inflows, outflows, and facilitation fees automatically." },
                  { icon: Code2, title: "Balance Calculation", desc: "Net Balance = Total Inflows − Total Outflows − KOB Fees" },
                  { icon: Wallet, title: "Automated Settlement", desc: "Based on your schedule, KOB transfers your net balance to your account." },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    className="flex items-start gap-4 py-5"
                    custom={i}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0 mt-0.5">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 border-b border-border/40 pb-5">
                      <h3 className="font-bold mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 shadow-xl">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-6">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Start Processing Payments?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join developers and fintechs already using KOB Payment Facilitation across Cameroon
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <SmartGetStartedButton size="lg" className="text-lg px-10 py-6" />
                <Link to="/contact">
                  <Button size="lg" variant="outline" className="text-lg px-10 py-6">
                    Talk to Sales
                  </Button>
                </Link>
              </div>

              <div className="mt-12 pt-8 border-t border-border/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { icon: Shield, title: "PCI-DSS", sub: "Certified" },
                    { icon: Lock, title: "Bank-Level", sub: "Security" },
                    { icon: TrendingUp, title: "99.9%", sub: "Uptime" },
                    { icon: Users, title: "24/7", sub: "Support" },
                  ].map((t) => (
                    <div key={t.title} className="text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-2">
                        <t.icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm font-semibold">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.sub}</p>
                    </div>
                  ))}
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
