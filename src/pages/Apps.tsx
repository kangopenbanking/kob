import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import {
  Building2, Smartphone, Wallet, CreditCard, History,
  ShieldCheck, Send, Store, Users, QrCode, BarChart3, Receipt,
  Package, ArrowRight, Globe, Check, Download,
  Bus, UserCheck, Monitor, ShoppingCart, Zap, Star, ArrowDown,
  Fingerprint, Bell, MessageCircle, PieChart, Shield, Landmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import kfsSendImg from '@/assets/kfs-send.png';
import kfsReceiveImg from '@/assets/kfs-receive.png';
import kfs3secImg from '@/assets/kfs-3sec.png';
import { Helmet } from 'react-helmet-async';

/* ── Types ── */
interface AppFeature { icon: React.ElementType; label: string; desc: string }
interface AppData {
  title: string;
  tagline: string;
  description: string;
  status: 'live' | 'coming-soon';
  color: string;
  colorLight: string;
  link?: string;
  image: string;
  features: AppFeature[];
  stats: { value: string; label: string }[];
}

/* ── App Data ── */
const apps: AppData[] = [
  {
    title: 'Kang Banking',
    tagline: 'Digital banking for every institution',
    description: 'A fully white-labeled mobile banking experience. Each financial institution gets their own branded app with instant deployment — wallet management, P2P transfers, virtual cards, and complete transaction history.',
    status: 'live',
    color: 'hsl(var(--primary))',
    colorLight: 'hsl(var(--primary) / 0.08)',
    link: '/bank/f493095b-037a-40cf-82bc-3a3ab74550dd',
    image: kfsSendImg,
    features: [
      { icon: Wallet, label: 'Smart Wallets', desc: 'Multi-currency wallet with real-time balances' },
      { icon: Send, label: 'Instant Transfers', desc: 'P2P and bank transfers in under 3 seconds' },
      { icon: CreditCard, label: 'Virtual Cards', desc: 'Issue and manage cards directly from the app' },
      { icon: History, label: 'Transaction History', desc: 'Full audit trail with search and filters' },
      { icon: ShieldCheck, label: 'KYC & Compliance', desc: 'Built-in identity verification workflow' },
      { icon: QrCode, label: 'QR Payments', desc: 'Scan to pay at any supported merchant' },
    ],
    stats: [
      { value: '15+', label: 'Institutions' },
      { value: '<3s', label: 'Transfer Speed' },
      { value: '99.9%', label: 'Uptime' },
    ],
  },
  {
    title: 'Kang Business',
    tagline: 'Commerce & operations in one place',
    description: 'Everything a merchant needs to run their business — from point-of-sale to inventory management, staff controls, analytics, travel services, and a full digital storefront. Built for businesses of all sizes.',
    status: 'live',
    color: 'hsl(30, 90%, 50%)',
    colorLight: 'hsl(30, 90%, 50% / 0.08)',
    link: '/biz',
    image: kfsReceiveImg,
    features: [
      { icon: Monitor, label: 'POS & Orders', desc: 'Process sales and manage orders seamlessly' },
      { icon: Package, label: 'Inventory', desc: 'Track stock levels and product variants' },
      { icon: BarChart3, label: 'Analytics', desc: 'Revenue insights and performance dashboards' },
      { icon: Bus, label: 'Travel Services', desc: 'Transport booking and ticket management' },
      { icon: Users, label: 'Staff & CRM', desc: 'Team management with role-based access' },
      { icon: Store, label: 'Storefront', desc: 'Public online store with coupon support' },
    ],
    stats: [
      { value: '500+', label: 'Merchants' },
      { value: '12', label: 'Feature Modules' },
      { value: '24/7', label: 'Support' },
    ],
  },
  {
    title: 'Kang Consumer',
    tagline: 'Your finances, unified',
    description: 'One app to manage accounts across every banking institution — transfers, savings goals, virtual cards, credit scores, bill payments, and community savings groups. The financial super-app for everyday life.',
    status: 'live',
    color: 'hsl(var(--secondary))',
    colorLight: 'hsl(var(--secondary) / 0.08)',
    link: '/app',
    image: kfs3secImg,
    features: [
      { icon: QrCode, label: 'Scan & Pay', desc: 'QR code payments at any merchant' },
      { icon: Send, label: 'Send & Request', desc: 'Transfer money or request payments instantly' },
      { icon: CreditCard, label: 'Cards & Banking', desc: 'Virtual and physical card management' },
      { icon: Receipt, label: 'Bills & Invoices', desc: 'Pay bills and track invoices in one place' },
      { icon: PieChart, label: 'Credit Score', desc: 'Monitor and improve your credit health' },
      { icon: Wallet, label: 'Savings Groups', desc: 'Piggy bank and Njangi community savings' },
    ],
    stats: [
      { value: '10K+', label: 'Active Users' },
      { value: '6', label: 'Savings Tools' },
      { value: 'Free', label: 'To Download' },
    ],
  },
  {
    title: 'Kang Merchant',
    tagline: 'Payment gateway for professionals',
    description: 'A full-featured merchant portal with payment acceptance, transport & tourism management, WooCommerce sync, staff portals, settlement tracking, and QR ticket scanning — all from a unified dashboard.',
    status: 'live',
    color: 'hsl(271, 91%, 65%)',
    colorLight: 'hsl(271, 91%, 65% / 0.08)',
    link: '/merchant-register',
    image: kfsSendImg,
    features: [
      { icon: Monitor, label: 'POS Terminal', desc: 'Accept payments from any device' },
      { icon: ShoppingCart, label: 'E-Commerce Sync', desc: 'WooCommerce and Shopify integration' },
      { icon: Bus, label: 'Travel & Tourism', desc: 'Booking and route management tools' },
      { icon: BarChart3, label: 'Settlements', desc: 'Automated payout tracking and reports' },
      { icon: UserCheck, label: 'Staff Portal', desc: 'Role-based access for your team' },
      { icon: QrCode, label: 'QR Tickets', desc: 'Generate and scan event/transport tickets' },
    ],
    stats: [
      { value: '200+', label: 'Merchants' },
      { value: '5', label: 'Integrations' },
      { value: '0.5%', label: 'Transaction Fee' },
    ],
  },
];

const platformBenefits = [
  { icon: Globe, title: 'Multi-Tenant Architecture', desc: 'One codebase serves every institution with unique branding and configuration.' },
  { icon: Shield, title: 'Bank-Grade Security', desc: 'End-to-end encryption, FAPI compliance, and PCI DSS standards built-in.' },
  { icon: Zap, title: 'Instant Deployment', desc: 'Register your institution and launch a branded app in minutes, not months.' },
  { icon: Download, title: 'PWA Native Experience', desc: 'Install directly from the browser — no app store needed. Works offline.' },
  { icon: Bell, title: 'Real-Time Notifications', desc: 'Push notifications, in-app alerts, and email updates for every transaction.' },
  { icon: Fingerprint, title: 'Biometric Authentication', desc: 'Fingerprint and face ID support for secure, frictionless login.' },
];

/* ── Scroll-Linked Parallax for Hero ── */
function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-[90vh] flex items-center overflow-hidden bg-background">
      {/* Subtle background shapes */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] rounded-full bg-primary/[0.03] -translate-y-1/4 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[30vw] h-[30vw] rounded-full bg-secondary/[0.04] translate-y-1/4 -translate-x-1/4" />

      <motion.div style={{ y, opacity }} className="container relative z-10 mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-5 py-2 mb-8"
          >
            <Star className="h-3.5 w-3.5 text-primary" fill="currentColor" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide">Kang Open Banking v1 — Native PWA Apps</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground tracking-tight leading-[1.08]"
          >
            Banking apps built
            <br />
            <span className="text-primary">for the future</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Four native PWA mobile applications — banking, business, consumer, and merchant — 
            all powered by a single platform. Install instantly. No app store required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-lg" asChild>
              <Link to="/bank/f493095b-037a-40cf-82bc-3a3ab74550dd">
                Try Banking Demo <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-base" asChild>
              <Link to="/register">Register Institution</Link>
            </Button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-8 sm:gap-x-16 max-w-2xl mx-auto"
          >
            {[
              { value: '4', label: 'Apps' },
              { value: '15+', label: 'Institutions' },
              { value: '10K+', label: 'Users' },
              { value: '99.9%', label: 'Uptime' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown className="h-5 w-5 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ── App Showcase Section ── */
function AppSection({ app, index }: { app: AppData; index: number }) {
  const isEven = index % 2 === 0;

  return (
    <section className={`relative py-20 sm:py-28 overflow-hidden ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}>
      <div className="container mx-auto px-4">
        <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12 lg:gap-20`}>
          
          {/* Image / Phone Side */}
          <motion.div
            initial={{ opacity: 0, x: isEven ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 w-full max-w-lg"
          >
            <div className="relative">
              {/* Phone mockup */}
              <div className="relative mx-auto w-64 sm:w-72">
                <div className="relative aspect-[9/18] rounded-[2.5rem] border-[3px] border-foreground/10 p-3 shadow-2xl">
                  {/* Notch */}
                  <div className="absolute left-1/2 top-3 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground/10" />
                  
                  <div className="h-full rounded-[2rem] overflow-hidden">
                    <img
                      src={app.image}
                      alt={`${app.title} app screenshot`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Floating badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                  className="absolute -bottom-4 -right-4 sm:-right-8 rounded-2xl bg-card border border-border shadow-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: app.colorLight }}>
                      <Zap className="h-4 w-4" style={{ color: app.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{app.stats[1].value}</p>
                      <p className="text-[10px] text-muted-foreground">{app.stats[1].label}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Floating stat */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                  className="absolute -top-4 -left-4 sm:-left-8 rounded-2xl bg-card border border-border shadow-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: app.colorLight }}>
                      <Star className="h-4 w-4" style={{ color: app.color }} fill="currentColor" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{app.stats[0].value}</p>
                      <p className="text-[10px] text-muted-foreground">{app.stats[0].label}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Content Side */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 max-w-xl"
          >
            {/* Status badge */}
            <div className="flex items-center gap-3 mb-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: app.colorLight, color: app.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: app.color }} />
                {app.status === 'live' ? 'Live' : 'Coming Soon'}
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight leading-tight">
              {app.title}
            </h2>
            <p className="mt-2 text-lg font-medium" style={{ color: app.color }}>
              {app.tagline}
            </p>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              {app.description}
            </p>

            {/* Features grid */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {app.features.map((f, fi) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + fi * 0.06 }}
                  className="flex items-start gap-3 rounded-xl p-3 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: app.colorLight }}
                  >
                    <f.icon className="h-4.5 w-4.5" style={{ color: app.color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Stats + CTA */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              {app.status === 'live' && app.link ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto rounded-full px-8 h-12 text-white shadow-lg"
                  style={{ backgroundColor: app.color }}
                  asChild
                >
                  <Link to={app.link}>
                    Launch App <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <span
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-8 h-12 text-sm font-semibold border border-border text-muted-foreground"
                >
                  Coming Soon
                </span>
              )}
              <div className="grid grid-cols-3 sm:flex sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                {app.stats.map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── Main Component ── */
export default function Apps() {
  return (
    <>
      <Helmet>
        <title>Apps — Kang Open Banking | PWA Mobile Apps</title>
        <meta name="description" content="Explore Kang Open Banking's suite of native PWA mobile apps — Banking, Business, Consumer, and Merchant. Install instantly, no app store needed." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <HeroSection />

        {/* ── App Sections ── */}
        {apps.map((app, i) => (
          <AppSection key={app.title} app={app} index={i} />
        ))}

        {/* ── Platform Benefits ── */}
        <section className="py-20 sm:py-28 bg-background">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Why Kang</span>
              <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
                Built for scale, designed for trust
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Enterprise-grade infrastructure powering every app in the ecosystem.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {platformBenefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="group rounded-2xl border border-border bg-card p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                    <b.icon className="h-6 w-6 text-primary" strokeWidth={1.8} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How Multi-Tenancy Works ── */}
        <section className="py-20 sm:py-28 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-secondary">How It Works</span>
              <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
                Same platform, your brand
              </h2>
              <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                Three steps to launch your institution's fully branded app.
              </p>
            </motion.div>

            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                {/* Connecting line */}
                <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 z-0" />

                {[
                  { num: '01', icon: Building2, title: 'Register', desc: 'Sign up your institution on the Kang platform with your details and branding assets.', color: 'hsl(var(--primary))' },
                  { num: '02', icon: Landmark, title: 'Customize', desc: 'Your logo, colors, and tagline are applied automatically across the entire app experience.', color: 'hsl(30, 90%, 50%)' },
                  { num: '03', icon: Smartphone, title: 'Launch', desc: 'Share your unique URL — customers install the PWA directly from their browser.', color: 'hsl(var(--secondary))' },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15, duration: 0.6 }}
                    className="relative text-center z-10"
                  >
                    <div className="mx-auto mb-6 relative inline-block">
                      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-card border-2 border-border shadow-md">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: step.color + '15' }}>
                          <step.icon className="h-9 w-9" style={{ color: step.color }} strokeWidth={1.5} />
                        </div>
                      </div>
                      <div
                        className="absolute -top-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold shadow-md"
                        style={{ backgroundColor: step.color }}
                      >
                        {step.num}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground max-w-[240px] mx-auto leading-relaxed">{step.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── White-Label Demo ── */}
        <section className="py-20 sm:py-28 bg-background">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">White-Label</span>
              <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
                Every institution, uniquely branded
              </h2>
              <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                Each app inherits the institution's identity — colors, logo, and name — automatically.
              </p>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-6 max-w-3xl mx-auto">
              {[
                { name: 'Afriland First Bank', color: 'hsl(var(--primary))', initials: 'AF' },
                { name: 'Ecobank Cameroon', color: 'hsl(var(--secondary))', initials: 'EC' },
                { name: 'UBA Cameroon', color: 'hsl(var(--destructive))', initials: 'UB' },
              ].map((bank, i) => (
                <motion.div
                  key={bank.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="w-56 rounded-2xl border border-border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  <div
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-primary-foreground shadow-md"
                    style={{ backgroundColor: bank.color }}
                  >
                    {bank.initials}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{bank.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">Branded PWA</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 sm:py-28 bg-primary">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground tracking-tight">
                Ready to launch your app?
              </h2>
              <p className="mt-4 text-primary-foreground/80 max-w-md mx-auto text-lg leading-relaxed">
                Register your institution and get a fully branded banking app in minutes.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="rounded-full px-10 h-12 text-base bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg"
                  asChild
                >
                  <Link to="/register">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-10 h-12 text-base border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
                  asChild
                >
                  <Link to="/contact">Contact Sales</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
}
