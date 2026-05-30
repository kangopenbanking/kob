import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import {
  Search,
  BookOpen,
  CreditCard,
  Shield,
  Users,
  Building2,
  Globe,
  ArrowRight,
  HelpCircle,
  Smartphone,
  Store,
  Landmark,
  ChevronDown,
  ChevronUp,
  Layers,
  Lock,
  Banknote,
  BarChart3,
  FileText,
  Headphones,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollReveal } from "@/components/ScrollReveal";

import hcMobileApp from "@/assets/help-centre/hc-mobile-app.webp";
import hcTablet from "@/assets/help-centre/hc-tablet.webp";
import hcAnalytics from "@/assets/help-centre/hc-analytics.webp";
import hcContent from "@/assets/help-centre/hc-content.webp";
import hcBrand from "@/assets/help-centre/hc-brand.webp";
import hcTools from "@/assets/help-centre/hc-tools.webp";
import hcDashboard from "@/assets/help-centre/hc-dashboard.webp";
import hcNotifications from "@/assets/help-centre/hc-notifications.webp";
import hcBuild from "@/assets/help-centre/hc-build.webp";
import hcDevices from "@/assets/help-centre/hc-devices.webp";
import hcBanner from "@/assets/help-centre/hc-banner.png";

/* ── Smooth entrance ─────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

/* ── Data ─────────────────────────────────────────────── */
const guideCards = [
  {
    title: "Consumer App Guide",
    desc: "Set up your personal account, link banks, send money and track spending — all from your phone.",
    icon: Smartphone,
    to: "/manual/customers",
    color: "hsl(217 91% 60%)",
    bg: "hsl(217 91% 60% / 0.1)",
    img: hcMobileApp,
  },
  {
    title: "Business & Merchant Guide",
    desc: "Configure your storefront, manage inventory, accept payments and handle white-label checkout.",
    icon: Store,
    to: "/manual/merchants",
    color: "hsl(142 71% 45%)",
    bg: "hsl(142 71% 45% / 0.1)",
    img: hcBrand,
  },
  {
    title: "Banking App Guide",
    desc: "Navigate the institutional banking dashboard, process bulk payouts and monitor compliance.",
    icon: Landmark,
    to: "/manual/banks",
    color: "hsl(262 83% 58%)",
    bg: "hsl(262 83% 58% / 0.1)",
    img: hcDashboard,
  },
  {
    title: "Developer Documentation",
    desc: "Integrate the KOB API — from authentication and webhooks to sandbox testing and SDKs.",
    icon: Layers,
    to: "/manual/developers",
    color: "hsl(25 95% 53%)",
    bg: "hsl(25 95% 53% / 0.1)",
    img: hcBuild,
  },
];

const topicCards = [
  { title: "Getting Started", desc: "Create an account, verify your identity and link your first bank.", icon: BookOpen, to: "/faq", color: "hsl(217 91% 60%)" },
  { title: "Payments & Transfers", desc: "Send money domestically & cross-border via Mobile Money, bank transfer or card.", icon: CreditCard, to: "/documentation", color: "hsl(142 71% 45%)" },
  { title: "Security & Privacy", desc: "How we protect your data with end-to-end encryption, 2FA, and PCI-DSS compliance.", icon: Shield, to: "/security-policy", color: "hsl(0 84% 60%)" },
  { title: "Account Management", desc: "Update your profile, manage linked accounts, reset your PIN or change your email.", icon: Users, to: "/faq", color: "hsl(262 83% 58%)" },
  { title: "For Banks & FIs", desc: "Bank onboarding, connector types, API integration and compliance requirements.", icon: Building2, to: "/bank-integration-guide", color: "hsl(25 95% 53%)" },
  { title: "API & Developer Tools", desc: "Full API reference, SDKs, sandbox environment, webhook events and changelogs.", icon: Globe, to: "/developer", color: "hsl(340 82% 52%)" },
];

const cameroonFaqs: { q: string; a: string }[] = [
  {
    q: "What is Open Banking?",
    a: "Open Banking is a system where banks securely share customer financial data — with the customer's consent — through standardised APIs. This enables third-party providers (fintechs, merchants, other banks) to build innovative products like instant payments, credit scoring, and account aggregation on top of traditional banking rails.",
  },
  {
    q: "How does Open Banking work in practice?",
    a: "When you connect your bank account to an Open Banking service, the bank provides your data (balances, transaction history) or initiates payments via secure APIs. Every connection requires your explicit consent, uses encrypted channels, and can be revoked at any time. Think of it like giving a trusted app read-only (or payment) access to your bank, without sharing your login credentials.",
  },
  {
    q: "Why does Cameroon need Open Banking?",
    a: "Cameroon has over 15 commercial banks, a rapidly growing Mobile Money ecosystem with MTN MoMo and Orange Money, yet interoperability remains fragmented. Most citizens lack a formal credit history, payments between banks take days, and SMEs struggle to access affordable financial services. Open Banking provides a unified API layer that connects all these rails — bank accounts, mobile wallets, and payment networks — enabling instant transfers, real-time credit scoring, and seamless digital commerce.",
  },
  {
    q: "Is my data safe with Open Banking?",
    a: "Absolutely. KOB operates under COBAC & BEAC regulatory frameworks, uses end-to-end TLS 1.3 encryption, enforces mTLS for bank-to-platform communication, and is PCI-DSS certified. You control exactly which apps can access your data and can revoke access instantly from your dashboard.",
  },
  {
    q: "What APIs does KOB provide?",
    a: "KOB provides three core API categories: Account Information Services (AISP) for reading balances and transactions, Payment Initiation Services (PISP) for triggering domestic and cross-border payments, and Confirmation of Funds (CoF) for real-time balance checks. These are built on PSD2-inspired standards adapted to the CEMAC regulatory region.",
  },
  {
    q: "How does KOB handle Mobile Money?",
    a: "KOB integrates directly with MTN MoMo, Orange Money, and other mobile wallet providers in Cameroon. You can send, receive, and check balances on Mobile Money accounts through the same API you use for traditional bank accounts — giving developers and merchants a single integration point for all payment rails.",
  },
  {
    q: "What is a Domestic RIB and how does KOB use it?",
    a: "The RIB (Relevé d'Identité Bancaire) is the 23-digit domestic account identifier used across CEMAC banks, composed of Bank Code (5 digits), Branch Code (5 digits), Account Number (11 digits), and RIB Key (2 digits). KOB validates RIB numbers using MOD-97 checksum verification and uses them for all domestic interbank transfers.",
  },
  {
    q: "Can businesses use KOB for e-commerce payments?",
    a: "Yes. KOB offers a payment gateway for merchants and businesses, including a WooCommerce plugin, hosted checkout pages, QR-code payments through the POS system, and direct API integration. Enterprise merchants can even white-label the entire checkout experience with their own domain and branding.",
  },
  {
    q: "What is CrediQ and how does it work?",
    a: "CrediQ is KOB's AI-powered credit scoring engine. It analyses your bank transaction history, Mobile Money activity, rent payments, and savings patterns to generate a credit score — even if you've never had a formal loan. This helps banks and lenders make faster, more inclusive lending decisions.",
  },
  {
    q: "How do I get started with KOB?",
    a: "For consumers, download the Kang app and create a free personal account. For businesses, sign up on the Business portal and complete KYB verification. For developers, visit the Developer Portal to get sandbox API keys and start building. For banks, contact us for a connector onboarding guide.",
  },
];

/* ── Component ────────────────────────────────────────── */
export default function HelpCentre() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredFaqs = cameroonFaqs.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>Help Centre — Kang Open Banking</title>
        <meta name="description" content="Guides, FAQs and everything you need to know about Open Banking in Cameroon. Get started with KOB today." />
      </Helmet>

      {/* ── HERO ───────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-28 lg:pt-28 lg:pb-36">
        {/* Banner cover image */}
        <div className="absolute inset-0">
          <img
            src={hcBanner}
            alt="KOB Help Centre"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <motion.p
              custom={0}
              variants={fadeUp}
              className="mb-4 text-sm font-semibold tracking-widest uppercase text-primary"
            >
              KOB Help Centre
            </motion.p>

            <motion.h1
              custom={1}
              variants={fadeUp}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ lineHeight: 1.08 }}
            >
              How can we
              <br />
              <span className="text-primary">help you today?</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              className="mt-6 text-lg text-muted-foreground max-w-xl text-pretty"
            >
              Everything you need to understand Open Banking in Cameroon, manage
              your account and build with the KOB API.
            </motion.p>

            <motion.div custom={3} variants={fadeUp} className="mt-8 max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search guides, FAQs, topics…"
                  className="h-14 pl-12 pr-4 rounded-2xl text-base shadow-lg border-border/60 bg-card"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── QUICK TOPIC CARDS ──────────────────────────── */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">
              Browse by Topic
            </h2>
            <p className="mt-3 text-center text-muted-foreground max-w-lg mx-auto">
              Jump straight to what you need — from account basics to deep API
              integrations.
            </p>
          </ScrollReveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topicCards.map((card, i) => (
              <ScrollReveal key={card.title} delay={i * 0.07}>
                <Link to={card.to} className="group block">
                  <div className="relative h-full rounded-2xl border border-border/50 bg-card p-7 transition-shadow duration-300 hover:shadow-xl active:scale-[0.98]">
                    <div
                      className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${card.color}15` }}
                    >
                      <card.icon className="h-6 w-6" style={{ color: card.color }} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-bold">{card.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {card.desc}
                    </p>
                    <ArrowRight
                      className="mt-4 h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
                      strokeWidth={1.5}
                    />
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT GUIDES (large image cards) ─────────── */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">
              Product Guides
            </h2>
            <p className="mt-3 text-center text-muted-foreground max-w-lg mx-auto">
              Step-by-step manuals for every KOB product — written in plain
              language so anyone can follow along.
            </p>
          </ScrollReveal>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            {guideCards.map((card, i) => (
              <ScrollReveal key={card.title} delay={i * 0.1}>
                <Link to={card.to} className="group block">
                  <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm transition-shadow duration-300 hover:shadow-2xl active:scale-[0.98]">
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={card.img}
                        alt={card.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-7">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl"
                          style={{ backgroundColor: card.bg }}
                        >
                          <card.icon className="h-5 w-5" style={{ color: card.color }} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-bold">{card.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {card.desc}
                      </p>
                      <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
                        Read guide
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── OPEN BANKING EXPLAINER ─────────────────────── */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <ScrollReveal direction="left">
              <div>
                <p className="text-sm font-semibold tracking-widest uppercase text-primary mb-4">
                  Open Banking Explained
                </p>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ lineHeight: 1.15 }}>
                  What is Open Banking — and why does Cameroon need it?
                </h2>
                <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    Open Banking is a financial framework that allows licensed
                    third-party providers to securely access bank account data and
                    initiate payments through standardised APIs — with the
                    customer's explicit consent.
                  </p>
                  <p>
                    In Cameroon, over <strong className="text-foreground">15 commercial banks</strong> and two
                    dominant mobile-money operators (MTN MoMo & Orange Money) serve
                    a market where <strong className="text-foreground">70 %+ of transactions</strong> still
                    happen outside formal banking rails. Interbank transfers can
                    take days, most citizens lack a credit history, and SMEs are
                    under-served by legacy systems.
                  </p>
                  <p>
                    KOB bridges that gap. Our API layer unifies bank accounts,
                    mobile wallets, and card networks into a single integration
                    point — enabling <strong className="text-foreground">instant domestic payments</strong>,
                    real-time credit scoring through CrediQ, and seamless digital
                    commerce for merchants of every size.
                  </p>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/about">
                    <Button size="lg" className="rounded-xl" aria-label="About Kang Open Banking — company and platform overview">
                      About Kang Open Banking
                    </Button>
                  </Link>
                  <Link to="/developer">
                    <Button variant="outline" size="lg" className="rounded-xl">
                      Developer Portal
                    </Button>
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative">
                <img
                  src={hcAnalytics}
                  alt="Open Banking analytics"
                  className="rounded-3xl shadow-2xl"
                  loading="lazy"
                />
                <img
                  src={hcTools}
                  alt="Banking tools"
                  className="absolute -bottom-8 -left-8 w-48 rounded-2xl shadow-xl border-4 border-background hidden md:block"
                  loading="lazy"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">
              How Open Banking Works
            </h2>
            <p className="mt-3 text-center text-muted-foreground max-w-xl mx-auto">
              Three simple API categories power the entire ecosystem.
            </p>
          </ScrollReveal>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Account Information (AISP)",
                desc: "Read-only access to balances, transaction history and account details. Customers consent once and can revoke any time.",
                color: "hsl(217 91% 60%)",
                img: hcContent,
              },
              {
                icon: Banknote,
                title: "Payment Initiation (PISP)",
                desc: "Trigger domestic and cross-border payments directly from a user's bank account — faster settlement, lower fees.",
                color: "hsl(142 71% 45%)",
                img: hcTablet,
              },
              {
                icon: BarChart3,
                title: "Confirmation of Funds",
                desc: "Real-time balance checks before completing a transaction — reducing failed payments and overdrafts.",
                color: "hsl(25 95% 53%)",
                img: hcNotifications,
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.1}>
                <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card h-full">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={item.img}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <div
                      className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: item.color }} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO BENEFITS ───────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <ScrollReveal direction="left">
              <img
                src={hcDevices}
                alt="Multi-platform banking"
                className="rounded-3xl shadow-2xl"
                loading="lazy"
              />
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div>
                <p className="text-sm font-semibold tracking-widest uppercase text-primary mb-4">
                  Built for Everyone
                </p>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ lineHeight: 1.15 }}>
                  Who benefits from Open Banking in Cameroon?
                </h2>

                <div className="mt-8 space-y-6">
                  {[
                    { icon: Users, label: "Individuals", text: "Track spending across banks & mobile wallets, build credit history through CrediQ, and send money instantly." },
                    { icon: Store, label: "Merchants & SMEs", text: "Accept digital payments from any bank or MoMo provider, automate reconciliation, and access working-capital products." },
                    { icon: Landmark, label: "Banks & FIs", text: "Modernise legacy infrastructure, offer embedded finance products, and comply with COBAC digital-services requirements." },
                    { icon: Layers, label: "Developers & Fintechs", text: "Build payment apps, lending platforms, budgeting tools and more on a single, well-documented API." },
                  ].map((item) => (
                    <div key={item.label} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <item.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h4 className="font-bold">{item.label}</h4>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── FAQs ───────────────────────────────────────── */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4 max-w-3xl">
          <ScrollReveal>
            <h2 className="text-3xl font-bold tracking-tight text-center sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-center text-muted-foreground">
              Everything you need to know about Open Banking and KOB.
            </p>
          </ScrollReveal>

          <div className="mt-12 space-y-3">
            {filteredFaqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <ScrollReveal key={i} delay={i * 0.04}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full text-left rounded-2xl border border-border/50 bg-card px-6 py-5 transition-shadow duration-200 hover:shadow-md active:scale-[0.995]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-bold text-base">{faq.q}</h3>
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.5} />
                      ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      )}
                    </div>
                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pt-3 text-sm text-muted-foreground leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  </button>
                </ScrollReveal>
              );
            })}
            {filteredFaqs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No results found for "{search}" — try a different keyword.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── CONTACT / SUPPORT CTA ──────────────────────── */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/40 p-10 lg:p-16 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Headphones className="h-8 w-8 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Still need help?
              </h2>
              <p className="mt-3 text-muted-foreground max-w-md mx-auto">
                Our support team is available Monday–Saturday, 8 AM – 8 PM WAT.
                Reach us through any of these channels.
              </p>

              <div className="mt-10 grid gap-6 sm:grid-cols-3">
                {[
                  { icon: Mail, label: "Email Support", detail: "support@kangopenbanking.com", to: "/contact" },
                  { icon: MessageSquare, label: "Live Chat", detail: "Average response under 5 min", to: "/contact" },
                  { icon: HelpCircle, label: "FAQ & Guides", detail: "100+ articles and walkthroughs", to: "/faq" },
                ].map((ch) => (
                  <Link key={ch.label} to={ch.to} className="group">
                    <div className="rounded-2xl border border-border/40 bg-card p-6 transition-shadow duration-300 hover:shadow-lg active:scale-[0.98]">
                      <ch.icon className="mx-auto h-6 w-6 text-primary mb-3" strokeWidth={1.5} />
                      <h4 className="font-bold">{ch.label}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{ch.detail}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
