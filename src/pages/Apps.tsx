import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Building2, Palette, Smartphone, Wallet, CreditCard, History,
  ShieldCheck, Send, Store, Users, QrCode, BarChart3, Receipt,
  Package, ArrowRight, Layers, Globe, Lock, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

interface AppFeature {
  icon: React.ElementType;
  label: string;
}

interface AppPhase {
  title: string;
  subtitle: string;
  status: 'live' | 'coming-soon';
  accentColor: string;
  bgAccent: string;
  textAccent: string;
  features: AppFeature[];
  link?: string;
  phase: number;
}

const apps: AppPhase[] = [
  {
    title: 'Banking App',
    subtitle: 'Full-featured mobile banking for every institution',
    status: 'live',
    accentColor: 'bg-fi-blue',
    bgAccent: 'bg-fi-blue/10',
    textAccent: 'text-fi-blue',
    phase: 1,
    link: '/bank/f493095b-037a-40cf-82bc-3a3ab74550dd',
    features: [
      { icon: Wallet, label: 'Wallet & Balances' },
      { icon: Send, label: 'P2P Transfers' },
      { icon: CreditCard, label: 'Virtual Cards' },
      { icon: History, label: 'Transaction History' },
      { icon: ShieldCheck, label: 'KYC Verification' },
      { icon: QrCode, label: 'QR Payments' },
    ],
  },
  {
    title: 'Merchant App',
    subtitle: 'Accept payments, manage settlements & analytics',
    status: 'coming-soon',
    accentColor: 'bg-fi-green',
    bgAccent: 'bg-fi-green/10',
    textAccent: 'text-fi-green',
    phase: 2,
    features: [
      { icon: Store, label: 'Storefront POS' },
      { icon: Receipt, label: 'Invoice & Billing' },
      { icon: BarChart3, label: 'Sales Analytics' },
      { icon: Package, label: 'Settlement Mgmt' },
      { icon: QrCode, label: 'QR Accept' },
      { icon: Users, label: 'Customer CRM' },
    ],
  },
  {
    title: 'Customer App',
    subtitle: 'Personal finance, credit scores & budgeting',
    status: 'coming-soon',
    accentColor: 'bg-fi-purple',
    bgAccent: 'bg-fi-purple/10',
    textAccent: 'text-fi-purple',
    phase: 3,
    features: [
      { icon: Wallet, label: 'Multi-Bank View' },
      { icon: BarChart3, label: 'Spending Insights' },
      { icon: ShieldCheck, label: 'Credit Score' },
      { icon: Receipt, label: 'Bill Reminders' },
      { icon: Globe, label: 'Cross-Border' },
      { icon: Lock, label: 'Secure Vault' },
    ],
  },
];

const steps = [
  { icon: Building2, title: 'Register', desc: 'Institution signs up on the platform' },
  { icon: Palette, title: 'Brand', desc: 'Colors, logo & tagline applied automatically' },
  { icon: Smartphone, title: 'Launch', desc: 'Customers access their bank\'s dedicated app' },
];

const tenantDemos = [
  { name: 'Afriland First Bank', color: 'hsl(210 80% 40%)', initials: 'AF' },
  { name: 'Ecobank Cameroon', color: 'hsl(150 60% 35%)', initials: 'EC' },
  { name: 'UBA Cameroon', color: 'hsl(0 70% 45%)', initials: 'UB' },
];

export default function Apps() {
  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-primary py-24 lg:py-32">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 h-64 w-64 rounded-full bg-primary-foreground" />
          <div className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-primary-foreground" />
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} custom={0} className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">
              Kang Open Banking v1
            </motion.p>
            <motion.h1 variants={fadeUp} custom={1} className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
              One Platform, Every Bank's Own App
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
              Each institution gets a fully branded PWA — same powerful codebase, unique identity. 
              Register once, launch instantly.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/bank/f493095b-037a-40cf-82bc-3a3ab74550dd">
                  Launch Banking Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/register">Register Institution</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Animated phone mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mx-auto mt-16 max-w-xs"
          >
            <div className="relative mx-auto aspect-[9/16] w-56 rounded-[2rem] border-4 border-primary-foreground/20 bg-background p-3 shadow-2xl">
              <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-muted" />
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[1.5rem] bg-muted/50 p-4 text-center">
                <Smartphone className="h-10 w-10 text-primary" />
                <span className="text-sm font-semibold text-foreground">Your Bank</span>
                <span className="text-xs text-muted-foreground">Branded PWA</span>
                <div className="mt-2 flex gap-2">
                  {['bg-fi-blue', 'bg-fi-green', 'bg-fi-purple'].map((c) => (
                    <motion.div
                      key={c}
                      className={`h-3 w-3 rounded-full ${c}`}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 2, delay: Math.random() }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-14 text-center text-3xl font-bold text-foreground"
          >
            How Multi-Tenancy Works
          </motion.h2>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="flex flex-col items-center text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <s.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                {i < steps.length - 1 && (
                  <ChevronRight className="mt-4 hidden h-5 w-5 rotate-90 text-muted-foreground/40 md:block md:rotate-0 md:absolute md:right-0 md:top-1/2" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Ecosystem ── */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4 text-center text-3xl font-bold text-foreground"
          >
            App Ecosystem
          </motion.h2>
          <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
            Three purpose-built apps covering the full financial lifecycle — each white-labeled per institution.
          </p>

          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
            {apps.map((app, i) => (
              <motion.div
                key={app.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                whileTap={{ scale: 0.98 }}
              >
                <Card className="relative overflow-hidden h-full">
                  {/* Accent strip */}
                  <div className={`h-1.5 ${app.accentColor}`} />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{app.title}</CardTitle>
                      <Badge
                        variant={app.status === 'live' ? 'default' : 'secondary'}
                        className={app.status === 'live' ? 'bg-fi-green text-primary-foreground' : ''}
                      >
                        {app.status === 'live' ? 'Live' : 'Coming Soon'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{app.subtitle}</p>
                    <span className={`text-xs font-semibold ${app.textAccent}`}>Phase {app.phase}</span>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {app.features.map((f) => (
                        <div key={f.label} className={`flex items-center gap-2 rounded-lg p-2 ${app.bgAccent}`}>
                          <f.icon className={`h-4 w-4 ${app.textAccent}`} />
                          <span className="text-xs font-medium text-foreground">{f.label}</span>
                        </div>
                      ))}
                    </div>
                    {app.status === 'live' && app.link ? (
                      <Button className="w-full" asChild>
                        <Link to={app.link}>
                          Launch Demo <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button className="w-full" disabled>
                        Coming Soon
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Multi-Tenancy Demo ── */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4 text-center text-3xl font-bold text-foreground"
          >
            Same App, Different Brand
          </motion.h2>
          <p className="mx-auto mb-12 max-w-lg text-center text-muted-foreground">
            Each institution's app inherits their unique branding — automatically.
          </p>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-6">
            {tenantDemos.map((t, i) => (
              <motion.div
                key={t.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="w-52"
              >
                <Card className="overflow-hidden text-center">
                  <div className="h-1.5" style={{ backgroundColor: t.color }} />
                  <CardContent className="py-6">
                    <div
                      className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-primary-foreground"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.initials}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <div className="mx-auto mt-3 flex items-center justify-center gap-1">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      <div className="h-2 w-8 rounded bg-muted" />
                      <div className="h-2 w-6 rounded bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical Architecture ── */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4 text-center text-3xl font-bold text-foreground"
          >
            Technical Architecture
          </motion.h2>
          <p className="mx-auto mb-12 max-w-lg text-center text-muted-foreground">
            A single React codebase with dynamic tenant resolution via URL parameters.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-2xl"
          >
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  <Layers className="h-5 w-5 text-primary" />
                  <code className="text-sm font-mono text-foreground">/bank/:institutionId/*</code>
                  <Badge variant="secondary" className="ml-auto">Phase 1</Badge>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  <Layers className="h-5 w-5 text-fi-green" />
                  <code className="text-sm font-mono text-foreground">/merchant/:institutionId/*</code>
                  <Badge variant="secondary" className="ml-auto">Phase 2</Badge>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  <Layers className="h-5 w-5 text-fi-purple" />
                  <code className="text-sm font-mono text-foreground">/app/:institutionId/*</code>
                  <Badge variant="secondary" className="ml-auto">Phase 3</Badge>
                </div>
                <div className="mt-4 rounded-lg border border-border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Context Flow</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    <code className="rounded bg-primary/10 px-2 py-0.5 text-primary">URL :institutionId</code>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <code className="rounded bg-primary/10 px-2 py-0.5 text-primary">TenantProvider</code>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <code className="rounded bg-primary/10 px-2 py-0.5 text-primary">Branded UI</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-primary py-16">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-primary-foreground">Ready to Launch Your App?</h2>
            <p className="mx-auto mt-3 max-w-md text-primary-foreground/70">
              Register your institution and get a fully branded banking app in minutes.
            </p>
            <Button size="lg" variant="secondary" className="mt-8" asChild>
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
