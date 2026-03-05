import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Building2, Palette, Smartphone, Wallet, CreditCard, History,
  ShieldCheck, Send, Store, Users, QrCode, BarChart3, Receipt,
  Package, ArrowRight, Layers, Globe, Lock, ChevronRight, Check, ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import kfsSendImg from '@/assets/kfs-send.png';
import kfsReceiveImg from '@/assets/kfs-receive.png';
import kfs3secImg from '@/assets/kfs-3sec.png';

/* ── Animations ── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

/* ── Data ── */
interface AppFeature { icon: React.ElementType; label: string }
interface AppPhase {
  title: string; subtitle: string; status: 'live' | 'coming-soon';
  accent: string; accentBorder: string; accentBg: string; accentText: string;
  features: AppFeature[]; link?: string; phase: number; description: string;
}

const apps: AppPhase[] = [
  {
    title: 'Banking App',
    subtitle: 'Full-featured mobile banking for every institution',
    description: 'Empower your customers with a fully branded digital banking experience. White-labeled per institution with instant deployment.',
    status: 'live',
    accent: '#3B82F6', accentBorder: 'border-blue-500/30', accentBg: 'bg-blue-500/10', accentText: 'text-blue-400',
    phase: 1, link: '/bank/f493095b-037a-40cf-82bc-3a3ab74550dd',
    features: [
      { icon: Wallet, label: 'Wallet & Balances' }, { icon: Send, label: 'P2P Transfers' },
      { icon: CreditCard, label: 'Virtual Cards' }, { icon: History, label: 'Transaction History' },
      { icon: ShieldCheck, label: 'KYC Verification' }, { icon: QrCode, label: 'QR Payments' },
    ],
  },
  {
    title: 'Merchant App',
    subtitle: 'Accept payments, manage settlements & analytics',
    description: 'Give merchants the tools to accept payments, track sales, and manage their business — all from a single app.',
    status: 'coming-soon',
    accent: '#22C55E', accentBorder: 'border-green-500/30', accentBg: 'bg-green-500/10', accentText: 'text-green-400',
    phase: 2,
    features: [
      { icon: Store, label: 'Storefront POS' }, { icon: Receipt, label: 'Invoice & Billing' },
      { icon: BarChart3, label: 'Sales Analytics' }, { icon: Package, label: 'Settlement Mgmt' },
      { icon: QrCode, label: 'QR Accept' }, { icon: Users, label: 'Customer CRM' },
    ],
  },
  {
    title: 'Customer App',
    subtitle: 'Unified fintech wallet connecting all banking institutions',
    description: 'A single app for consumers to manage accounts across all institutions — transfers, savings, cards, and more.',
    status: 'live',
    accent: '#A855F7', accentBorder: 'border-purple-500/30', accentBg: 'bg-purple-500/10', accentText: 'text-purple-400',
    phase: 3, link: '/app',
    features: [
      { icon: QrCode, label: 'QR Scan Pay' }, { icon: Send, label: 'Transfer & Request' },
      { icon: CreditCard, label: 'Cards & Banking' }, { icon: Receipt, label: 'Bills & Invoices' },
      { icon: ShieldCheck, label: 'Credit Score' }, { icon: Wallet, label: 'Piggy Bank & Njangi' },
    ],
  },
];

const steps = [
  { icon: Building2, title: 'Register', desc: 'Institution signs up on the platform', num: '01' },
  { icon: Palette, title: 'Brand', desc: 'Colors, logo & tagline applied automatically', num: '02' },
  { icon: Smartphone, title: 'Launch', desc: 'Customers access their bank\'s dedicated app', num: '03' },
];

const tenantDemos = [
  { name: 'Afriland First Bank', color: '#2563EB', initials: 'AF' },
  { name: 'Ecobank Cameroon', color: '#16A34A', initials: 'EC' },
  { name: 'UBA Cameroon', color: '#DC2626', initials: 'UB' },
];

/* ── Floating App Card ── */
function AppShowcaseCard({ app, index }: { app: AppPhase; index: number }) {
  const sectionBgs = [
    'from-[#0c1929] to-[#0f1f35]',
    'from-[#0a1a14] to-[#0d2219]',
    'from-[#150c24] to-[#1a1030]',
  ];

  return (
    <section className={`relative py-28 overflow-hidden bg-gradient-to-b ${sectionBgs[index]}`}>
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      
      {/* Accent glow */}
      <div
        className="absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full blur-[150px] opacity-[0.07]"
        style={{ backgroundColor: app.accent }}
      />

      <div className="container relative z-10 mx-auto px-4">
        <div className="flex flex-col items-center gap-16 lg:gap-20">
          
          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex-shrink-0 relative"
          >
            {/* Decorative ring */}
            <div className="absolute -inset-6 rounded-[3.5rem] border opacity-20" style={{ borderColor: app.accent + '40' }} />
            
            <div className="relative mx-auto w-60 sm:w-64">
              <div className="relative aspect-[9/17] rounded-[2.5rem] border-2 bg-gradient-to-b from-slate-800 to-slate-950 p-2.5 shadow-2xl" style={{ borderColor: app.accent + '30' }}>
                <div className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/10" />
                <div className="flex h-full flex-col rounded-[2rem] bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <span className="text-[9px] font-medium text-white/50">9:41</span>
                    <div className="flex gap-1">
                      <div className="h-1.5 w-3 rounded-sm bg-white/30" />
                      <div className="h-1.5 w-1.5 rounded-sm bg-white/30" />
                      <div className="h-1.5 w-3 rounded-sm bg-white/30" />
                    </div>
                  </div>
                  <div className="px-5 pt-2 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: app.accent + '30' }}>
                        <Smartphone className="h-4 w-4" style={{ color: app.accent }} />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-white">{app.title}</p>
                        <p className="text-[8px] text-white/40">Phase {app.phase}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 px-4 pb-4 space-y-1.5">
                    {app.features.map((f, fi) => (
                      <motion.div
                        key={f.label}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + fi * 0.08 }}
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ backgroundColor: app.accent + '10' }}
                      >
                        <f.icon className="h-3.5 w-3.5 shrink-0" style={{ color: app.accent }} strokeWidth={1.8} />
                        <span className="text-[10px] font-medium text-white/80">{f.label}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mx-auto mb-3 h-1 w-24 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="absolute inset-0 -z-10 rounded-[3rem] blur-3xl opacity-20" style={{ backgroundColor: app.accent }} />
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="flex-1 max-w-xl text-center"
          >
            <motion.div variants={fadeUp} custom={0} className="flex items-center justify-center gap-3 mb-5">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: app.accent + '20', color: app.accent }}>
                {app.phase}
              </div>
              <Badge
                className={`text-[10px] rounded-full px-3 py-1 border font-semibold ${
                  app.status === 'live'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {app.status === 'live' ? '● Live' : '○ Coming Soon'}
              </Badge>
            </motion.div>

            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-bold text-white mb-2 tracking-tight">
              {app.title}
            </motion.h2>
            <motion.p variants={fadeUp} custom={1.5} className="text-lg font-medium mb-4" style={{ color: app.accent }}>
              {app.subtitle}
            </motion.p>
            <motion.p variants={fadeUp} custom={2} className="text-slate-400 text-base mb-10 leading-relaxed">
              {app.description}
            </motion.p>

            {/* Feature list — clean checklist style */}
            <motion.div variants={fadeUp} custom={3} className="grid grid-cols-2 gap-x-6 gap-y-3 mb-10 text-left mx-auto max-w-md">
              {app.features.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: app.accent + '20' }}>
                    <Check className="h-3.5 w-3.5" style={{ color: app.accent }} strokeWidth={2.5} />
                  </div>
                  <span className="text-sm text-slate-300">{f.label}</span>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp} custom={4}>
              {app.status === 'live' && app.link ? (
                <Button size="lg" className="rounded-full px-8 text-white shadow-lg" style={{ backgroundColor: app.accent }} asChild>
                  <Link to={app.link}>
                    Launch Demo <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" className="rounded-full px-8 bg-white/5 text-slate-400 border border-white/10" disabled>
                  Coming Soon
                </Button>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── Main Component ── */
export default function Apps() {
  return (
    <div className="min-h-screen bg-[#080e1a]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-36">
        {/* Geometric decorations */}
        <div className="absolute top-20 left-[10%] h-64 w-64 rounded-full border border-blue-500/10" />
        <div className="absolute top-40 right-[15%] h-40 w-40 rounded-full border border-purple-500/10" />
        <div className="absolute bottom-20 left-[20%] h-32 w-32 rounded-full border border-green-500/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-blue-600/5 blur-[150px]" />

        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-8">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">Kang Open Banking v1</span>
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]">
              One Platform,{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                Every Bank's Own App
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="mx-auto mt-7 max-w-2xl text-lg text-slate-400 leading-relaxed">
              Each institution gets a fully branded PWA — same powerful codebase, unique identity.
              Register once, launch instantly.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-8 shadow-lg shadow-blue-600/25" asChild>
                <Link to="/bank/f493095b-037a-40cf-82bc-3a3ab74550dd">
                  Launch Banking Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 border-white/10 text-white hover:bg-white/5" asChild>
                <Link to="/register">Register Institution</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* ── Three App Preview Cards ── */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mx-auto mt-24 grid max-w-3xl grid-cols-3 gap-4 sm:gap-6"
          >
            {apps.map((app, i) => (
              <motion.div
                key={app.title}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
                className="group"
              >
                <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 text-center backdrop-blur-sm hover:border-white/10 transition-all duration-300 hover:-translate-y-1">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: app.accent + '15', border: `1px solid ${app.accent}30` }}>
                    <Smartphone className="h-5 w-5" style={{ color: app.accent }} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-1">{app.title}</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">Phase {app.phase}</p>
                  <div className="mt-3">
                    <Badge className={`text-[9px] rounded-full px-2 py-0.5 border ${
                      app.status === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {app.status === 'live' ? 'Live' : 'Soon'}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Partner bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm"
          >
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600 font-semibold">Compatible with</span>
            {tenantDemos.map((t) => (
              <span key={t.name} className="text-slate-400 font-medium text-sm">{t.name}</span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works — Horizontal timeline ── */}
      <section className="relative py-28 overflow-hidden bg-gradient-to-b from-[#080e1a] via-[#0d1526] to-[#080e1a]">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        <div className="container relative z-10 mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">How it works</span>
            <h2 className="mt-4 text-3xl sm:text-5xl font-bold text-white tracking-tight">How Multi-Tenancy Works</h2>
          </motion.div>

          <div className="mx-auto max-w-4xl relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-14 left-[16%] right-[16%] h-px bg-gradient-to-r from-blue-500/30 via-blue-500/50 to-blue-500/30" />

            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <motion.div
                  key={s.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="relative text-center"
                >
                  {/* Number circle */}
                  <div className="mx-auto mb-6 relative">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-blue-500/20 bg-[#0d1526]">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/10">
                        <s.icon className="h-8 w-8 text-blue-400" strokeWidth={1.5} />
                      </div>
                    </div>
                    <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg shadow-blue-600/30">
                      {s.num}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-400 max-w-[200px] mx-auto">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── App Ecosystem ── */}
      {apps.map((app, appIdx) => (
        <AppShowcaseCard key={app.title} app={app} index={appIdx} />
      ))}

      {/* ── Multi-Tenancy Demo — Dark card grid ── */}
      <section className="relative py-28 overflow-hidden bg-gradient-to-b from-[#0a0f1e] to-[#0d1225]">
        <div className="absolute top-1/2 right-0 h-64 w-64 rounded-full bg-purple-600/5 blur-[120px]" />
        <div className="container relative z-10 mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">White-labeling</span>
            <h2 className="mt-4 text-3xl sm:text-5xl font-bold text-white tracking-tight">Same App, Different Brand</h2>
            <p className="mx-auto mt-5 max-w-lg text-slate-400 leading-relaxed">
              Each institution's app inherits their unique branding — automatically.
            </p>
          </motion.div>

          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-6">
            {tenantDemos.map((t, i) => (
              <motion.div
                key={t.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="w-56 group"
              >
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 text-center hover:border-white/10 transition-all duration-300 hover:-translate-y-1">
                  <div
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg"
                    style={{ backgroundColor: t.color + '20', border: `1px solid ${t.color}30`, boxShadow: `0 8px 30px ${t.color}15` }}
                  >
                    {t.initials}
                  </div>
                  <p className="text-sm font-semibold text-white mb-3">{t.name}</p>
                  <div className="mx-auto flex items-center justify-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <div className="h-2 w-10 rounded-full bg-white/10" />
                    <div className="h-2 w-6 rounded-full bg-white/5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical Architecture — Clean code blocks ── */}
      <section className="relative py-28 bg-[#060a14]">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        <div className="container relative z-10 mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Under the hood</span>
            <h2 className="mt-4 text-3xl sm:text-5xl font-bold text-white tracking-tight">Technical Architecture</h2>
            <p className="mx-auto mt-5 max-w-lg text-slate-400 leading-relaxed">
              A single React codebase with dynamic tenant resolution via URL parameters.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mx-auto max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-8 space-y-3 backdrop-blur-sm"
          >
            {[
              { icon: Layers, color: '#3B82F6', route: '/bank/:institutionId/*', phase: 'Phase 1', label: 'Banking' },
              { icon: Layers, color: '#22C55E', route: '/merchant/:institutionId/*', phase: 'Phase 2', label: 'Merchant' },
              { icon: Layers, color: '#A855F7', route: '/app/*', phase: 'Phase 3', label: 'Unified' },
            ].map((r) => (
              <div key={r.route} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: r.color + '15' }}>
                  <r.icon className="h-5 w-5" style={{ color: r.color }} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono text-slate-300 block truncate">{r.route}</code>
                  <span className="text-[10px] text-slate-500">{r.label}</span>
                </div>
                <Badge variant="secondary" className="bg-white/5 text-slate-400 border-white/10 text-[10px] shrink-0">
                  {r.phase}
                </Badge>
              </div>
            ))}

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Context Flow</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <code className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F620' }}>URL :institutionId</code>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                <code className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F620' }}>TenantProvider</code>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                <code className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: '#3B82F620', color: '#60A5FA', border: '1px solid #3B82F620' }}>Branded UI</code>
              </div>
              <p className="text-[11px] text-slate-500 mt-4">Banking Apps: per-institution • Customer App: unified platform</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA — Gradient accent ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-emerald-600/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        
        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">Ready to Launch Your App?</h2>
            <p className="mx-auto mt-5 max-w-md text-slate-400 leading-relaxed">
              Register your institution and get a fully branded banking app in minutes.
            </p>
            <Button size="lg" className="mt-10 bg-blue-600 hover:bg-blue-500 text-white rounded-full px-10 shadow-lg shadow-blue-600/25" asChild>
              <Link to="/register">
                Register Your Institution <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
