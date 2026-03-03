import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Shield, TrendingUp, Bell, Target, Award, Users, ArrowRight, ChevronRight, Zap, PiggyBank, Home, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import crediqHero from "@/assets/crediq-hero.jpg";
import crediqCard from "@/assets/crediq-card.jpg";
import crediqMobile from "@/assets/crediq-mobile.webp";
import crediqLifestyle from "@/assets/crediq-lifestyle.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const } }),
};

const ecosystemItems = [
  { icon: TrendingUp, label: "Loan Repayments", impact: "+5–15 pts", desc: "On-time payments boost your score" },
  { icon: PiggyBank, label: "Piggy Bank Savings", impact: "+3–5 pts", desc: "Consistent saving habits rewarded" },
  { icon: Users, label: "Njangi Contributions", impact: "+3–8 pts", desc: "Community savings build trust" },
  { icon: Home, label: "Rent Reporting", impact: "+5–10 pts", desc: "Turn rent into credit history" },
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

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={crediqHero} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-foreground/60" />
          </div>
          <div className="relative container mx-auto px-4 py-28 md:py-40">
            <motion.div
              initial="hidden"
              animate="visible"
              className="max-w-2xl space-y-6"
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
                  className="rounded-xl text-base px-8 border-white/30 text-white hover:bg-white/10 hover:text-white"
                >
                  Learn More
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-6 pt-2 text-sm text-white/60">
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" strokeWidth={2} /> Bank-level security</span>
                <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" strokeWidth={2} /> 300–850 scale</span>
                <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" strokeWidth={2} /> Free forever</span>
              </motion.div>
            </motion.div>
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
                    className="rounded-2xl border border-border bg-background p-6 flex flex-col gap-3"
                  >
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
                    </div>
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    <span className="mt-auto text-sm font-bold text-primary">{item.impact}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
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
