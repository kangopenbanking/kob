import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Building2,
  Smartphone,
  Users,
  CheckCircle2,
  Clock,
  Banknote,
  TrendingUp,
  Lock,
  HeartHandshake,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Receipt,
} from "lucide-react";

import heroPhone from "@/assets/remittance/hero-phone.png";
import youngWoman from "@/assets/remittance/young-woman.jpg";
import familyHappy from "@/assets/remittance/family-happy.jpg";
import womanCard from "@/assets/remittance/woman-card.jpg";
import manLaptop from "@/assets/remittance/man-laptop.jpeg";
import marketVendor from "@/assets/remittance/market-vendor.jpeg";
import familyBed from "@/assets/remittance/family-bed.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const corridors = [
  { from: "🇫🇷 France", to: "🇨🇲 Cameroon", rate: "1 EUR = 655.957 XAF", fee: "0.5%", time: "Instant" },
  { from: "🇺🇸 USA", to: "🇨🇲 Cameroon", rate: "1 USD = 605.22 XAF", fee: "0.8%", time: "< 30 sec" },
  { from: "🇬🇧 UK", to: "🇨🇲 Cameroon", rate: "1 GBP = 765.43 XAF", fee: "0.6%", time: "< 1 min" },
  { from: "🇨🇦 Canada", to: "🇨🇲 Cameroon", rate: "1 CAD = 445.18 XAF", fee: "0.7%", time: "< 30 sec" },
  { from: "🇩🇪 Germany", to: "🇨🇲 Cameroon", rate: "1 EUR = 655.957 XAF", fee: "0.5%", time: "Instant" },
  { from: "🇳🇬 Nigeria", to: "🇨🇲 Cameroon", rate: "1 NGN = 0.39 XAF", fee: "0.3%", time: "Instant" },
];

const destinations = [
  { icon: Smartphone, title: "KOB Wallet", desc: "Instant credit to any KOB digital wallet. Spend, save, or withdraw instantly.", color: "from-emerald-500 to-emerald-600" },
  { icon: Landmark, title: "Bank Account", desc: "Direct deposit into any Cameroonian bank account via our bank connector network.", color: "from-blue-500 to-blue-600" },
  { icon: Receipt, title: "Bills & Invoices", desc: "Pay school fees, utilities, or merchant invoices directly from diaspora funds.", color: "from-amber-500 to-amber-600" },
];

const stats = [
  { value: "20+", label: "Partner corridors", icon: Globe },
  { value: "<30s", label: "Average delivery", icon: Zap },
  { value: "99.9%", label: "Platform uptime", icon: Shield },
  { value: "0.3%", label: "Lowest fees from", icon: TrendingUp },
];

const steps = [
  { num: "01", title: "Sender initiates", desc: "Family abroad sends money through any of our partner networks — Thunes, TerraPay, Onafriq, or others." },
  { num: "02", title: "We receive & verify", desc: "Funds arrive at KOB. We verify the transaction, screen for compliance, and lock the exchange rate." },
  { num: "03", title: "Smart routing", desc: "Our engine routes funds to the right destination — wallet, bank account, or bill payment." },
  { num: "04", title: "Instant credit", desc: "Recipient gets funds in their chosen destination. Real-time notifications at every step." },
];

export default function RemittanceLanding() {
  return (
    <div className="min-h-screen">
      {/* ══════════ HERO — Wise-style green hero ══════════ */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(90 60% 55%), hsl(145 45% 48%))" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-20 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate="visible" className="space-y-6">
              <motion.div custom={0} variants={fadeUp}>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-sm px-4 py-1.5 mb-4">
                  Remittance-as-a-Service
                </Badge>
              </motion.div>
              <motion.h1 custom={1} variants={fadeUp} className="text-5xl lg:text-7xl font-black text-white leading-[0.95] tracking-tight">
                THE FAST WAY TO
                <br />
                <span className="text-gray-900">SEND MONEY</span>
                <br />
                HOME
              </motion.h1>
              <motion.p custom={2} variants={fadeUp} className="text-lg text-white/90 max-w-lg leading-relaxed">
                Send money to family and loved ones in Cameroon. Arrive in seconds, not days.
                Low fees. Real exchange rates. Multiple delivery options.
              </motion.p>
              <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-3">
                <Link to="/app/send-money">
                  <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-8 h-14 text-base font-semibold shadow-xl">
                    Send money now <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/developer/api-explorer">
                  <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold backdrop-blur-sm">
                    Explore API
                  </Button>
                </Link>
              </motion.div>
              <motion.div custom={4} variants={fadeUp} className="flex items-center gap-6 pt-4">
                {[
                  { icon: Shield, text: "COBAC regulated" },
                  { icon: Lock, text: "Bank-grade security" },
                  { icon: Zap, text: "Instant delivery" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2 text-white/80 text-sm">
                    <item.icon className="h-4 w-4" />
                    <span>{item.text}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden lg:block"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img src={heroPhone} alt="Send money with KOB" className="w-full h-auto object-cover rounded-3xl" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-3xl" />
              </div>
              {/* Floating card */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="absolute -left-6 bottom-16 bg-white rounded-2xl p-4 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Transfer complete</p>
                    <p className="text-xs text-gray-500">250,000 XAF credited</p>
                  </div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="absolute -right-4 top-20 bg-white rounded-2xl p-4 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Delivered in 8s</p>
                    <p className="text-xs text-gray-500">Paris → Douala</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <s.icon className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-3xl font-black">{s.value}</p>
                <p className="text-sm text-gray-400 mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 text-sm">How it works</Badge>
            <h2 className="text-4xl lg:text-5xl font-black text-foreground">
              Money arrives in seconds
            </h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              A seamless four-step process from sender to recipient. No delays, no hidden fees.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="text-5xl font-black text-primary/10 group-hover:text-primary/20 transition-colors mb-4">
                      {step.num}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ DESTINATIONS — Full-width image sections (Wise style) ══════════ */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 text-sm">Delivery options</Badge>
            <h2 className="text-4xl lg:text-5xl font-black text-foreground">
              Choose where the money lands
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {destinations.map((dest, i) => (
              <motion.div
                key={dest.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <Card className="h-full overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group">
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${dest.color} p-8 flex items-center justify-center`}>
                      <dest.icon className="h-16 w-16 text-white/90" strokeWidth={1.2} />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground mb-2">{dest.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{dest.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PEOPLE SECTION — Photo grid like Wise ══════════ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-4 text-sm">Built for Cameroon</Badge>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-6">
                Connecting the diaspora
                <br />
                <span className="text-primary">to home</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Over 3 million Cameroonians live abroad. Every month, billions of XAF flow back home
                to support families, fund businesses, pay school fees, and build dreams. KOB makes
                that journey faster, cheaper, and safer.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: HeartHandshake, text: "Support families instantly" },
                  { icon: Building2, text: "Fund small businesses" },
                  { icon: Users, text: "Pay school fees directly" },
                  { icon: Banknote, text: "Transparent exchange rates" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="space-y-4">
                <img src={youngWoman} alt="Young Cameroonian woman" className="rounded-2xl w-full h-48 object-cover shadow-lg" loading="lazy" />
                <img src={familyHappy} alt="Happy family" className="rounded-2xl w-full h-64 object-cover shadow-lg" loading="lazy" />
              </div>
              <div className="space-y-4 pt-8">
                <img src={womanCard} alt="Woman making payment" className="rounded-2xl w-full h-64 object-cover shadow-lg" loading="lazy" />
                <img src={marketVendor} alt="Market vendor" className="rounded-2xl w-full h-48 object-cover shadow-lg" loading="lazy" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ CORRIDORS TABLE ══════════ */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge variant="outline" className="mb-4 text-sm">Live corridors</Badge>
            <h2 className="text-4xl lg:text-5xl font-black text-foreground">
              Popular routes to Cameroon
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Real-time exchange rates. Some of the lowest fees in the industry.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {corridors.map((c, i) => (
              <motion.div
                key={c.from}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold">{c.from}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-bold">{c.to}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Rate</span>
                        <span className="font-semibold text-foreground">{c.rate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fee</span>
                        <span className="font-semibold text-emerald-600">{c.fee}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Speed</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Zap className="h-3 w-3 text-amber-500" />{c.time}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FOR BUSINESSES / API ══════════ */}
      <section className="py-20 lg:py-28 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-400 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4">
                For Banks & Fintechs
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-black leading-tight mb-6">
                Remittance-as-a-Service
                <br />
                <span className="text-emerald-400">One API. All partners.</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                Integrate once with KOB and access 20+ remittance corridors. Our partner adapter
                layer normalizes data from Thunes, TerraPay, Onafriq, and others into a single
                canonical format. Full settlement reconciliation included.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  "Webhook-driven status updates at every lifecycle stage",
                  "Double-entry ledger with full audit trail",
                  "Automated settlement reconciliation with mismatch detection",
                  "Sanctions screening and compliance hooks built in",
                ].map((text) => (
                  <div key={text} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-gray-300 text-sm">{text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link to="/developer">
                  <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-8">
                    Read the docs <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/developer/guides/sdks">
                  <Button size="lg" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-800 rounded-full px-8">
                    Get the SDK
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <img src={manLaptop} alt="Developer integrating KOB API" className="rounded-3xl shadow-2xl w-full object-cover h-[450px]" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent rounded-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ SEND + RECEIVE CTA ══════════ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Inbound */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-0 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                <CardContent className="p-0">
                  <div className="relative h-64 overflow-hidden">
                    <img src={familyBed} alt="Family receiving remittance" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <Badge className="bg-blue-500 text-white border-0">
                        <ArrowDownLeft className="h-3 w-3 mr-1" /> Inbound
                      </Badge>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Receive money from abroad</h3>
                    <p className="text-muted-foreground mb-6">
                      Track every transfer sent to you by family and friends abroad. Get instant notifications
                      when money arrives.
                    </p>
                    <Link to="/app/remittances">
                      <Button className="rounded-full px-6">
                        Track inbound transfers <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Outbound */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Card className="h-full border-0 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                <CardContent className="p-0">
                  <div className="relative h-64 overflow-hidden">
                    <img src={womanCard} alt="Woman sending money" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <Badge className="bg-emerald-500 text-white border-0">
                        <ArrowUpRight className="h-3 w-3 mr-1" /> Outbound
                      </Badge>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Send money abroad</h3>
                    <p className="text-muted-foreground mb-6">
                      Transfer money from Cameroon to 140+ countries. Competitive rates, multiple delivery
                      methods, real-time tracking.
                    </p>
                    <Link to="/app/send-money">
                      <Button className="rounded-full px-6">
                        Send money now <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="py-20 lg:py-28 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(90 60% 55%), hsl(145 45% 48%))" }}>
        <div className="container mx-auto px-4 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              Start sending money
              <br />
              the smart way
            </h2>
            <p className="text-xl text-white/80 mb-10">
              Join thousands of families who trust KOB for fast, affordable remittances to Cameroon.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/app/send-money">
                <Button size="lg" className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-10 h-14 text-base font-semibold shadow-xl">
                  Get started free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/developer">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 rounded-full px-10 h-14 text-base font-semibold backdrop-blur-sm">
                  API Documentation
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
