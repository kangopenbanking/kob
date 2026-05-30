import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Shield, TrendingUp, Bell, Target, Award, Users, ArrowRight, ChevronRight, Zap, PiggyBank, Home, BarChart3, CreditCard, Landmark, HandCoins, FileCheck, AlertTriangle, CheckCircle2, XCircle, Clock, Repeat, Search } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import crediqHero from "@/assets/crediq-hero.jpg";
import crediqCard from "@/assets/crediq-card.jpg";
import crediqMobile from "@/assets/crediq-mobile.webp";
import crediqLifestyle from "@/assets/crediq-lifestyle.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }),
};

const ecosystemItems = [
  { icon: TrendingUp, label: "Loan Repayments", impact: "+5–15 pts", desc: "On-time payments directly boost your score. Late payments reduce it.", detail: "35% of your total score weight", colorClass: "text-emerald-600", bgClass: "bg-emerald-500/5", borderClass: "border-emerald-500/20", iconBg: "bg-emerald-500/10" },
  { icon: PiggyBank, label: "Piggy Bank Savings", impact: "+1–5 pts", desc: "Every deposit into personal or institutional savings plans is rewarded.", detail: "Capped at 10 pts/month", colorClass: "text-blue-600", bgClass: "bg-blue-500/5", borderClass: "border-blue-500/20", iconBg: "bg-blue-500/10" },
  { icon: Users, label: "Njangi Contributions", impact: "+3–8 pts", desc: "On-time circle contributions build community trust and creditworthiness.", detail: "Late contributions cost −5 to −15", colorClass: "text-violet-600", bgClass: "bg-violet-500/5", borderClass: "border-violet-500/20", iconBg: "bg-violet-500/10" },
  { icon: Home, label: "Rent Reporting", impact: "+5–10 pts", desc: "Turn your monthly rent into verifiable credit history via KRENTS codes.", detail: "Reported automatically each month", colorClass: "text-amber-600", bgClass: "bg-amber-500/5", borderClass: "border-amber-500/20", iconBg: "bg-amber-500/10" },
];

const scoreWeights = [
  { label: "Payment History", pct: 35, color: "hsl(var(--primary))" },
  { label: "Credit Utilization", pct: 30, color: "hsl(150 50% 50%)" },
  { label: "Account Age", pct: 15, color: "hsl(210 60% 55%)" },
  { label: "Credit Mix", pct: 10, color: "hsl(40 80% 55%)" },
  { label: "New Credit", pct: 10, color: "hsl(280 50% 55%)" },
];

export default function CrediQ() {
  const navigate = useNavigate();
  const [scoreCount, setScoreCount] = useState(0);
  const targetScore = 742;
  const scoreRef = useRef(false);

  useEffect(() => {
    if (scoreRef.current) return;
    scoreRef.current = true;
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setScoreCount(Math.round(eased * targetScore));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  const crediqSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "CrediQ Credit Score",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "description": "AI-powered credit scoring system for Cameroon and the CEMAC region. Build your credit score through loan repayments, savings, Njangi contributions, and rent payments.",
    "url": "https://kangopenbanking.com/crediq",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "XAF"
    },
    "provider": {
      "@type": "Organization",
      "name": "Kang Open Banking",
      "url": "https://kangopenbanking.com"
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>CrediQ — AI Credit Scoring for Cameroon | Kang Open Banking</title>
        <meta name="description" content="Build your credit score through loan repayments, savings, Njangi contributions, and rent payments. CrediQ is Cameroon's first AI-powered credit scoring system." />
        <link rel="canonical" href="https://kangopenbanking.com/crediq" />
        <script type="application/ld+json">{JSON.stringify(crediqSchema)}</script>
      </Helmet>
      <div className="min-h-screen bg-background">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={crediqHero} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-foreground/60" />
          </div>
          <div className="relative container mx-auto px-4 py-28 md:py-40">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              <motion.div
                initial="hidden"
                animate="visible"
                className="max-w-2xl space-y-6 flex-1"
              >
                <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  <Shield className="h-4 w-4 text-white" strokeWidth={2} />
                  <span className="text-sm font-semibold text-white">Cameroon Credit Standard (CCS)</span>
                </motion.div>

                <motion.h1 variants={fadeUp} custom={1} className="text-4xl font-bold text-white sm:text-5xl md:text-6xl lg:text-7xl leading-[1.08]">
                  Know Your <br />CrediQ Score
                </motion.h1>

                <motion.p variants={fadeUp} custom={2} className="text-lg text-white/80 max-w-xl leading-relaxed">
                  Your financial identity in Cameroon. A real-time credit score powered by your everyday activity—loans, savings, njangi, rent—opening doors to better opportunities.
                </motion.p>

                <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    size="lg"
                    onClick={() => navigate("/crediq/onboarding")}
                    className="rounded-xl text-base px-8 gap-2"
                  >
                    Get Your Free Score <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/crediq/info")}
                    className="rounded-xl text-base px-8 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    Learn how CrediQ scoring works
                  </Button>
                </motion.div>

                <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 pt-2 text-sm text-white/60">
                  <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" strokeWidth={2} /> Bank-level security</span>
                  <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" strokeWidth={2} /> 300–850 scale</span>
                  <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" strokeWidth={2} /> Free forever</span>
                </motion.div>
              </motion.div>

              {/* Donut Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                className="relative flex-shrink-0 hidden md:flex items-center justify-center"
              >
                <div className="relative w-[280px] h-[280px] lg:w-[320px] lg:h-[320px]">
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    {/* Background ring */}
                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
                    {/* Score segments */}
                    {[
                      { pct: 35, color: "hsl(150, 60%, 45%)", offset: 0 },
                      { pct: 30, color: "hsl(210, 70%, 55%)", offset: 35 },
                      { pct: 15, color: "hsl(270, 55%, 55%)", offset: 65 },
                      { pct: 10, color: "hsl(40, 80%, 55%)", offset: 80 },
                      { pct: 10, color: "hsl(0, 70%, 55%)", offset: 90 },
                    ].map((seg, i) => {
                      const circumference = 2 * Math.PI * 80;
                      const segLength = (seg.pct / 100) * circumference;
                      const segOffset = (seg.offset / 100) * circumference;
                      return (
                        <motion.circle
                          key={i}
                          cx="100" cy="100" r="80"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="18"
                          strokeLinecap="round"
                          strokeDasharray={`${segLength - 4} ${circumference - segLength + 4}`}
                          strokeDashoffset={-segOffset}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                        />
                      );
                    })}
                  </svg>
                  {/* Center score */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl lg:text-6xl font-bold text-white tabular-nums">{scoreCount}</span>
                    <span className="text-sm font-semibold text-emerald-400 mt-1">Very Good</span>
                    <span className="text-xs text-white/50 mt-0.5">out of 850</span>
                  </div>
                </div>
                {/* Legend */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-3 text-[10px] text-white/60 whitespace-nowrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(150, 60%, 45%)" }} />Payment</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(210, 70%, 55%)" }} />Utilization</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(270, 55%, 55%)" }} />Age</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(40, 80%, 55%)" }} />Mix</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ─── SCORE BREAKDOWN ─── */}
        <section className="container mx-auto px-4 py-24">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">How It's Calculated</p>
              <h2 className="text-3xl font-bold mb-4 md:text-4xl">A Score Built On <br />Your Real Life</h2>
              <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
                CrediQ weighs five key factors from your financial activity across the Kang ecosystem. Every payment, deposit, and contribution counts.
              </p>
              <div className="space-y-4">
                {scoreWeights.map((w) => (
                  <div key={w.label} className="flex items-center gap-4">
                    <div className="w-28 text-sm font-medium text-foreground shrink-0">{w.label}</div>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${w.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: w.color }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-bold text-foreground">{w.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img
                src={crediqCard}
                alt="Person holding a payment card"
                className="w-full rounded-3xl object-cover aspect-[3/4] max-h-[520px]"
              />
              <div className="absolute -bottom-6 -left-6 rounded-2xl bg-background border border-border p-5 shadow-lg max-w-[220px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Your Score</p>
                <p className="text-3xl font-bold text-primary">742</p>
                <p className="text-xs text-muted-foreground mt-1">Very Good · Band A</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── ECOSYSTEM ─── */}
        <section className="bg-muted/40">
          <div className="container mx-auto px-4 py-24">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">The Ecosystem Model</p>
              <h2 className="text-3xl font-bold md:text-4xl mb-3">Every Activity Counts</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Unlike traditional credit bureaus, CrediQ rewards your participation across the entire Kang platform.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
              {ecosystemItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i}
                    className={`rounded-2xl border ${item.borderClass} ${item.bgClass} p-6 flex flex-col gap-3`}
                  >
                    <div className={`h-11 w-11 rounded-xl ${item.iconBg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${item.colorClass}`} strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    <p className="text-xs text-muted-foreground/70 italic">{item.detail}</p>
                    <span className={`mt-auto text-sm font-bold ${item.colorClass}`}>{item.impact}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── BUILD YOUR CREDIT: APP FEATURES ─── */}
        <section className="container mx-auto px-4 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Kang App Features</p>
            <h2 className="text-3xl font-bold md:text-4xl mb-3">Build Your Credit With Every Action</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your everyday financial activities inside the Kang app directly impact your CrediQ score. Here's exactly how each feature contributes.
            </p>
          </div>

          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Loan Repayments */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="rounded-2xl border border-border bg-background p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Landmark className="h-7 w-7 text-primary" strokeWidth={1.8} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">Loan Repayments</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">Highest Impact</span>
                  </div>
                  <p className="text-muted-foreground mb-5 leading-relaxed">
                    Your loan repayment behavior is the single biggest factor in your credit score. On-time payments build a strong history, while late or missed payments can significantly reduce your score.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">On-Time Payment</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+5 to +15</p>
                      <p className="text-xs text-muted-foreground mt-1">Per successful installment</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-amber-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Late Payment</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">−10 to −40</p>
                      <p className="text-xs text-muted-foreground mt-1">After 3-day grace period</p>
                    </div>
                    <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-4 w-4 text-destructive" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Missed Installment</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">−50</p>
                      <p className="text-xs text-muted-foreground mt-1">Auto-detected daily</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Piggy Bank Savings */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}
              className="rounded-2xl border border-border bg-background p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <PiggyBank className="h-7 w-7 text-primary" strokeWidth={1.8} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">Piggy Bank Savings</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Steady Growth</span>
                  </div>
                  <p className="text-muted-foreground mb-5 leading-relaxed">
                    Build disciplined savings habits and earn credit points. Includes both personal goal-based plans and institutional savings products—every deposit counts toward your score.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">On-Time Plan Payment</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+3 to +5</p>
                      <p className="text-xs text-muted-foreground mt-1">Per scheduled contribution</p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Each Deposit</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+1 to +3</p>
                      <p className="text-xs text-muted-foreground mt-1">Capped at 10 pts/month</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Njangi Contributions */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={2}
              className="rounded-2xl border border-border bg-background p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Users className="h-7 w-7 text-primary" strokeWidth={1.8} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">Njangi Circles</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Community Trust</span>
                  </div>
                  <p className="text-muted-foreground mb-5 leading-relaxed">
                    Join group savings circles where members contribute to a rotating pot. Your consistency in contributing on time builds community trust and directly boosts your credit score.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">On-Time Contribution</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+3 to +8</p>
                      <p className="text-xs text-muted-foreground mt-1">Per cycle contribution</p>
                    </div>
                    <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Late Contribution</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">−5 to −15</p>
                      <p className="text-xs text-muted-foreground mt-1">Impacts group reliability</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Rent Reporting */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={3}
              className="rounded-2xl border border-border bg-background p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Home className="h-7 w-7 text-primary" strokeWidth={1.8} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">Rent Reporting</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">Easy Wins</span>
                  </div>
                  <p className="text-muted-foreground mb-5 leading-relaxed">
                    Turn your monthly rent into credit history. Set up a rent plan with a KRENTS reference code and every on-time payment is automatically reported to your CrediQ profile—no extra effort needed.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">On-Time Rent Payment</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+5 to +10</p>
                      <p className="text-xs text-muted-foreground mt-1">Reported automatically</p>
                    </div>
                    <div className="rounded-xl bg-muted/60 border border-border p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <FileCheck className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">KRENTS Reference</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">Each rent plan gets a unique code (e.g. KRENTS4821) for tracking</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* NjangiBox External Bureau */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={4}
              className="rounded-2xl border border-border bg-background p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Search className="h-7 w-7 text-primary" strokeWidth={1.8} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">NjangiBox — External Bureau Hub</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Advanced</span>
                  </div>
                  <p className="text-muted-foreground mb-5 leading-relaxed">
                    Access external credit bureau reports blended with your CrediQ data (70% internal, 30% external). File disputes, compare scores side-by-side, and resolve discrepancies—all from within the app.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Score Received</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+2</p>
                      <p className="text-xs text-muted-foreground mt-1">Each bureau fetch</p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <FileCheck className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Dispute Filed</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+2</p>
                      <p className="text-xs text-muted-foreground mt-1">Shows financial awareness</p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                        <span className="text-sm font-semibold text-foreground">Dispute Resolved</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">+5</p>
                      <p className="text-xs text-muted-foreground mt-1">Successful resolution</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="mt-14 text-center">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4">
              <Zap className="h-5 w-5 text-primary" strokeWidth={2} />
              <p className="text-sm font-medium text-foreground">
                <span className="font-bold">All events are immutable</span> — every credit action is permanently recorded for full traceability and reproducibility.
              </p>
            </div>
          </motion.div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="container mx-auto px-4 py-24">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div className="order-2 lg:order-1">
              <img
                src={crediqMobile}
                alt="Person checking CrediQ on phone"
                className="w-full rounded-3xl object-cover aspect-[3/4] max-h-[520px]"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Get Started in Minutes</p>
              <h2 className="text-3xl font-bold md:text-4xl mb-10">How It Works</h2>

              <div className="space-y-8">
                {[
                  { step: "01", title: "Answer 10 Simple Questions", desc: "Tell us about your employment, income, and financial goals. Takes just 3 minutes." },
                  { step: "02", title: "Get Your Baseline Score", desc: "Instantly receive your CrediQ score (300–850) and a personalized action plan." },
                  { step: "03", title: "Watch It Grow", desc: "Your score updates automatically as you use the platform—loans, savings, njangi, rent." },
                  { step: "04", title: "Unlock Better Opportunities", desc: "Higher scores mean better loan terms, lower interest rates, and more financial freedom." },
                ].map((s, i) => (
                  <motion.div
                    key={s.step}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i}
                    className="flex gap-5"
                  >
                    <span className="text-3xl font-bold text-primary/20 shrink-0 w-10">{s.step}</span>
                    <div>
                      <h3 className="font-semibold text-lg text-foreground mb-1">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES GRID ─── */}
        <section className="bg-muted/40">
          <div className="container mx-auto px-4 py-24">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Why CrediQ</p>
              <h2 className="text-3xl font-bold md:text-4xl">More Than Just a Number</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Free Forever", desc: "No hidden fees, always accessible to everyone in Cameroon." },
                { icon: TrendingUp, title: "Real-Time Updates", desc: "Your score updates automatically with every financial activity." },
                { icon: Bell, title: "Smart Alerts", desc: "Get notified when your score changes or new opportunities arise." },
                { icon: Target, title: "Action Plans", desc: "AI-powered recommendations to improve your creditworthiness." },
                { icon: Award, title: "Better Loan Terms", desc: "Higher scores unlock lower interest rates and better terms." },
                { icon: BarChart3, title: "Full Transparency", desc: "See exactly which factors affect your score and by how much." },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={f.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i}
                    className="rounded-2xl border border-border bg-background p-6"
                  >
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={crediqLifestyle} alt="" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0 bg-primary/80" />
          </div>
          <div className="relative container mx-auto px-4 py-28 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-2xl mx-auto space-y-6">
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl font-bold text-white md:text-4xl">
                Ready to Start Your <br />Credit Journey?
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-white/80">
                Join thousands of Cameroonians building their financial future with CrediQ. It's free, fast, and secure.
              </motion.p>
              <motion.div variants={fadeUp} custom={2}>
                <Button
                  size="lg"
                  onClick={() => navigate("/crediq/onboarding")}
                  className="rounded-xl text-base px-8 gap-2 bg-white text-primary hover:bg-white/90"
                >
                  Get Started — It's Free <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
