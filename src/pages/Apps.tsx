import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Building2, Palette, Smartphone, Wallet, CreditCard, History,
  ShieldCheck, Send, Store, Users, QrCode, BarChart3, Receipt,
  Package, ArrowRight, Layers, Globe, Lock, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ── Animations ── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

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
  { icon: Building2, title: 'Register', desc: 'Institution signs up on the platform' },
  { icon: Palette, title: 'Brand', desc: 'Colors, logo & tagline applied automatically' },
  { icon: Smartphone, title: 'Launch', desc: 'Customers access their bank\'s dedicated app' },
];

const tenantDemos = [
  { name: 'Afriland First Bank', color: '#2563EB', initials: 'AF' },
  { name: 'Ecobank Cameroon', color: '#16A34A', initials: 'EC' },
  { name: 'UBA Cameroon', color: '#DC2626', initials: 'UB' },
];

/* ── Phone Mockup ── */
function PhoneMockup({ app }: { app: AppPhase }) {
  return (
    <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' as const }} className="relative mx-auto w-56 sm:w-64">
      <div className="relative aspect-[9/17] rounded-[2.5rem] border-2 border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 p-2.5 shadow-2xl shadow-black/40">
        {/* Notch */}
        <div className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/10" />
        {/* Screen */}
        <div className="flex h-full flex-col rounded-[2rem] bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-[9px] font-medium text-white/50">9:41</span>
            <div className="flex gap-1">
              <div className="h-1.5 w-3 rounded-sm bg-white/30" />
              <div className="h-1.5 w-1.5 rounded-sm bg-white/30" />
              <div className="h-1.5 w-3 rounded-sm bg-white/30" />
            </div>
          </div>
          {/* App header */}
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
          {/* Feature grid inside phone */}
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
          {/* Bottom bar */}
          <div className="mx-auto mb-3 h-1 w-24 rounded-full bg-white/20" />
        </div>
      </div>
      {/* Glow behind phone */}
      <div className="absolute inset-0 -z-10 rounded-[3rem] blur-3xl opacity-20" style={{ backgroundColor: app.accent }} />
    </motion.div>
  );
}

/* ── Main Component ── */
export default function Apps() {
  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-purple-600/10 blur-[100px]" />

        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} custom={0} className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-400">
              Kang Open Banking v1
            </motion.p>
            <motion.h1 variants={fadeUp} custom={1} className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              One Platform, Every{' '}
               <span className="text-blue-400">
                Bank's Own App
               </span>
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
              Each institution gets a fully branded PWA — same powerful codebase, unique identity.
              Register once, launch instantly.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8" asChild>
                <Link to="/bank/f493095b-037a-40cf-82bc-3a3ab74550dd">
                  Launch Banking Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10 rounded-xl px-8" asChild>
                <Link to="/register">Register Institution</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Three small phones side by side */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mx-auto mt-20 flex justify-center gap-4 sm:gap-8"
          >
            {apps.map((app, i) => (
              <motion.div
                key={app.title}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
                className="w-28 sm:w-36"
              >
                <div className="aspect-[9/16] rounded-[1.2rem] sm:rounded-[1.5rem] border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-1.5 sm:p-2">
                  <div className="flex h-full flex-col items-center justify-center rounded-[1rem] sm:rounded-[1.2rem] bg-slate-900/60 gap-2">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: app.accent + '25' }}>
                      <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: app.accent }} strokeWidth={1.8} />
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-white">{app.title.split(' ')[0]}</span>
                    <span className="text-[8px] text-slate-500">Phase {app.phase}</span>
                    <div className="flex gap-1 mt-1">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: app.accent, opacity: j === 0 ? 1 : 0.3 }} />
                      ))}
                    </div>
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
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-slate-500 text-sm"
          >
            <span className="text-xs uppercase tracking-widest text-slate-600">Compatible with</span>
            {tenantDemos.map((t) => (
              <span key={t.name} className="text-slate-400 font-medium text-sm">{t.name}</span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-1/2 left-0 h-72 w-72 rounded-full bg-blue-600/5 blur-[80px]" />
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">How it works</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white">How Multi-Tenancy Works</h2>
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center backdrop-blur-sm hover:border-blue-500/20 transition-colors duration-300"
              >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                  <s.icon className="h-6 w-6 text-blue-400" strokeWidth={1.8} />
                </div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Step {i + 1}</div>
                <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Ecosystem (Individual Sections) ── */}
      {apps.map((app, appIdx) => {
        const isReversed = appIdx % 2 !== 0;
        return (
          <section key={app.title} className="relative py-24 overflow-hidden">
            {/* Section glow */}
            <div
              className="absolute top-1/3 h-96 w-96 rounded-full blur-[120px] opacity-10"
              style={{ backgroundColor: app.accent, left: isReversed ? 'auto' : '5%', right: isReversed ? '5%' : 'auto' }}
            />

            <div className="container mx-auto px-4">
              <div className={`flex flex-col items-center gap-12 lg:gap-20 ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
                {/* Phone mockup side */}
                <motion.div
                  initial={{ opacity: 0, x: isReversed ? 60 : -60 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-shrink-0"
                >
                  <PhoneMockup app={app} />
                </motion.div>

                {/* Content side */}
                <motion.div
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
                  className="flex-1 max-w-xl"
                >
                  <motion.div variants={fadeUp} custom={0} className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: app.accent }}>
                      Phase {app.phase}
                    </span>
                    <Badge
                      className={`text-[10px] rounded-full px-2.5 py-0.5 border ${
                        app.status === 'live'
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                      }`}
                    >
                      {app.status === 'live' ? '● Live' : 'Coming Soon'}
                    </Badge>
                  </motion.div>

                  <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold text-white mb-3">
                    {app.title}
                  </motion.h2>

                  <motion.p variants={fadeUp} custom={2} className="text-slate-400 text-base mb-8 leading-relaxed">
                    {app.description}
                  </motion.p>

                  {/* Feature grid */}
                  <motion.div variants={fadeUp} custom={3} className="grid grid-cols-2 gap-3 mb-8">
                    {app.features.map((f) => (
                      <div
                        key={f.label}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 ${app.accentBorder} bg-white/[0.02] hover:bg-white/[0.04] transition-colors`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${app.accentBg}`}>
                          <f.icon className={`h-4 w-4 ${app.accentText}`} strokeWidth={1.8} />
                        </div>
                        <span className="text-sm font-medium text-slate-300">{f.label}</span>
                      </div>
                    ))}
                  </motion.div>

                  <motion.div variants={fadeUp} custom={4}>
                    {app.status === 'live' && app.link ? (
                      <Button className="rounded-xl px-8 text-white" style={{ backgroundColor: app.accent }} asChild>
                        <Link to={app.link}>
                          Launch Demo <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button className="rounded-xl px-8 bg-slate-700 text-slate-300" disabled>
                        Coming Soon
                      </Button>
                    )}
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── Multi-Tenancy Demo ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-1/2 right-0 h-64 w-64 rounded-full bg-purple-600/8 blur-[100px]" />
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-purple-400">White-labeling</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Same App, Different Brand</h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-400">
              Each institution's app inherits their unique branding — automatically.
            </p>
          </motion.div>

          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-6">
            {tenantDemos.map((t, i) => (
              <motion.div
                key={t.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="w-52 group"
              >
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center hover:border-white/10 transition-colors">
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white"
                    style={{ backgroundColor: t.color + '30', border: `1px solid ${t.color}40` }}
                  >
                    {t.initials}
                  </div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <div className="mx-auto mt-3 flex items-center justify-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <div className="h-1.5 w-8 rounded bg-white/10" />
                    <div className="h-1.5 w-5 rounded bg-white/5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical Architecture ── */}
      <section className="relative py-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Under the hood</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Technical Architecture</h2>
            <p className="mx-auto mt-4 max-w-lg text-slate-400">
              A single React codebase with dynamic tenant resolution via URL parameters.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mx-auto max-w-2xl rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:p-8 space-y-4"
          >
            {[
              { icon: Layers, color: '#3B82F6', route: '/bank/:institutionId/*', phase: 'Phase 1' },
              { icon: Layers, color: '#22C55E', route: '/merchant/:institutionId/*', phase: 'Phase 2' },
              { icon: Layers, color: '#A855F7', route: '/app/*', phase: 'Phase 3 — Unified' },
            ].map((r) => (
              <div key={r.route} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <r.icon className="h-5 w-5" style={{ color: r.color }} strokeWidth={1.8} />
                <code className="text-sm font-mono text-slate-300">{r.route}</code>
                <Badge variant="secondary" className="ml-auto bg-white/5 text-slate-400 border-white/10 text-[10px]">
                  {r.phase}
                </Badge>
              </div>
            ))}

            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Context Flow</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <code className="rounded-lg bg-blue-500/10 px-3 py-1 text-blue-400 text-xs">URL :institutionId</code>
                <ArrowRight className="h-3 w-3 text-slate-600" />
                <code className="rounded-lg bg-blue-500/10 px-3 py-1 text-blue-400 text-xs">TenantProvider</code>
                <ArrowRight className="h-3 w-3 text-slate-600" />
                <code className="rounded-lg bg-blue-500/10 px-3 py-1 text-blue-400 text-xs">Branded UI</code>
              </div>
              <p className="text-[10px] text-slate-500 mt-3">Banking Apps: per-institution • Customer App: unified platform</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10" />
        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to Launch Your App?</h2>
            <p className="mx-auto mt-4 max-w-md text-slate-400">
              Register your institution and get a fully branded banking app in minutes.
            </p>
            <Button size="lg" className="mt-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-10" asChild>
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
