import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, ArrowRight, CheckCircle, TrendingUp, Shield, Clock,
  Shuffle, Hand, AlertTriangle, Coins, BarChart3, UserPlus
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { ScrollReveal } from "@/components/ScrollReveal";
import njangiBanner from "@/assets/njangi_kob.png";
import njangiGroup from "@/assets/njangi_kob_1.png";
import njangiMobile from "@/assets/njangi_kob_2.png";

const NjangiInfo = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Njangi — Group Savings & Money Pot | Kang Open Banking</title>
        <meta name="description" content="Join or create a Njangi group — the traditional Cameroonian money pot, digitized. Pool funds with friends and family while building your credit score." />
        <link rel="canonical" href="https://kangopenbanking.com/njangi" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Njangi — Digital Group Savings",
          "description": "The traditional Cameroonian rotating savings group, digitized. Pool funds, receive payouts, and build credit through on-time contributions.",
          "url": "https://kangopenbanking.com/njangi",
          "brand": { "@type": "Brand", "name": "Kang Open Banking" },
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "XAF", "availability": "https://schema.org/InStock" }
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden py-32 md:py-40">
        <img src={njangiBanner} alt="" className="absolute inset-0 w-full h-full object-contain md:object-cover object-center bg-primary/80" />
        <div className="absolute inset-0 bg-primary/50" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge variant="outline" className="mb-6 border-white/30 bg-white/10 text-white px-4 py-2">
              <Users className="h-4 w-4 inline mr-2" />
              Group Finance — Digitized
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Njangi
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-4 max-w-2xl mx-auto">
              The traditional Cameroonian money pot — now digital. Pool funds with friends, get payouts, and build your credit.
            </p>
            <p className="text-lg text-white/70 mb-8">
              Every contribution is tracked. On-time payments improve your CrediQ score.
            </p>
            <Link to="/auth">
              <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
                Start a Njangi Group
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works — with group illustration */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
              <ScrollReveal direction="left">
                <div>
                  <Badge variant="secondary" className="mb-4">How It Works</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">A Time-Honored Tradition, Modernized</h2>
                  <p className="text-lg text-muted-foreground mb-6">
                    Njangi brings the communal spirit of rotating savings into the digital age. Gather your circle, contribute together, and watch everyone benefit — all while building your financial reputation.
                  </p>
                  <div className="space-y-4">
                    {[
                      "Transparent contribution tracking",
                      "Automated rotation & payout scheduling",
                      "Every payment builds your CrediQ score",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <CheckCircle className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
              <ScrollReveal direction="right">
                <div className="relative">
                  <div className="rounded-3xl overflow-hidden shadow-2xl border border-border/30">
                    <img src={njangiGroup} alt="Njangi group saving together" className="w-full h-auto object-cover" />
                  </div>
                  <div className="absolute -bottom-4 -left-4 rounded-2xl bg-card border border-border/50 shadow-lg px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Active Groups</p>
                        <p className="text-sm font-bold text-foreground">2,500+</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: UserPlus, title: "Form a Group", desc: "Invite 3–10 friends or family members to join your Njangi circle.", step: "01" },
                { icon: Coins, title: "Everyone Contributes", desc: "Each member pays a fixed amount every week or month into the shared pot.", step: "02" },
                { icon: Users, title: "One Person Collects", desc: "Every cycle, one member receives the total pot. The rotation continues until everyone has received.", step: "03" },
                { icon: TrendingUp, title: "Credit Builds", desc: "On-time contributions are reported to CrediQ. Your credit score grows with each payment.", step: "04" },
              ].map((step, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <Card className="p-6 text-center hover:shadow-lg transition-all duration-300 group h-full">
                    <span className="text-xs font-bold text-primary/40 tracking-widest">{step.step}</span>
                    <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4 mt-2 group-hover:bg-primary/10 transition-colors">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features — with mobile illustration */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <ScrollReveal>
                <Badge variant="secondary" className="mb-4">Features</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Built for Trust & Flexibility</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Every feature is designed to replicate the trust of in-person Njangi while adding the safety of digital finance.
                </p>
              </ScrollReveal>
            </div>

            <div className="grid lg:grid-cols-5 gap-8 items-start">
              <div className="lg:col-span-3 grid sm:grid-cols-2 gap-6">
                {[
                  {
                    icon: Shuffle, title: "Random Rotation", badge: "Fair & Transparent", badgeClass: "",
                    desc: "The system randomly selects who receives the pot each cycle. No favoritism — the algorithm ensures everyone receives before any repeats."
                  },
                  {
                    icon: Hand, title: "Manual Selection", badge: "Flexible", badgeClass: "",
                    desc: "The group creator can manually choose the recipient each cycle. Ideal for groups with specific needs like emergency funds."
                  },
                  {
                    icon: AlertTriangle, title: "Late Interest", badge: "Configurable", badgeClass: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
                    desc: "Groups can set a late interest rate (e.g., 5%) that's automatically applied when members pay late."
                  },
                  {
                    icon: BarChart3, title: "Credit Reporting", badge: "CrediQ Integrated", badgeClass: "border-primary/50 text-primary",
                    desc: "Every contribution — on-time, late, or missed — is recorded as a credit event. Build a strong financial history."
                  },
                ].map((feat, i) => (
                  <ScrollReveal key={i} delay={i * 0.08}>
                    <Card className="p-6 hover:shadow-lg transition-all duration-300 h-full">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                          <feat.icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">{feat.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{feat.desc}</p>
                      <Badge variant="outline" className={feat.badgeClass}>{feat.badge}</Badge>
                    </Card>
                  </ScrollReveal>
                ))}
              </div>

              <div className="lg:col-span-2 flex justify-center">
                <ScrollReveal direction="right">
                  <div className="relative max-w-xs">
                    <div className="rounded-3xl overflow-hidden shadow-2xl border border-border/30">
                      <img src={njangiMobile} alt="Njangi on mobile" className="w-full h-auto object-cover" />
                    </div>
                    <div className="absolute -top-3 -right-3 rounded-2xl bg-card border border-border/50 shadow-lg px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Credit Impact</p>
                          <p className="text-xs font-bold text-green-600">+5 pts/cycle</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Impact */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-12">
                <Badge variant="secondary" className="mb-4">CrediQ Integration</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Credit Score Impact</h2>
                <p className="text-lg text-muted-foreground">Your Njangi participation directly shapes your financial identity</p>
              </div>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: TrendingUp, title: "On-Time", points: "+3 to +5", sub: "per contribution", bg: "bg-primary/5", border: "border-primary/20", color: "text-primary" },
                { icon: Clock, title: "Late", points: "-5 to -15", sub: "+ late interest from group", bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-200 dark:border-yellow-800", color: "text-yellow-600" },
                { icon: AlertTriangle, title: "Missed", points: "-25", sub: "per missed cycle", bg: "bg-destructive/5", border: "border-destructive/20", color: "text-destructive" },
              ].map((item, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <Card className={`p-6 ${item.bg} ${item.border} text-center hover:shadow-md transition-shadow`}>
                    <item.icon className={`h-8 w-8 ${item.color} mx-auto mb-3`} />
                    <h3 className="font-bold text-lg mb-2 text-foreground">{item.title}</h3>
                    <p className={`text-3xl font-bold ${item.color} mb-1`}>{item.points}</p>
                    <p className="text-sm text-muted-foreground">{item.sub}</p>
                  </Card>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={0.2}>
              <Card className="mt-10 p-8 bg-muted/40">
                <h3 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Example Scenario
                </h3>
                <div className="space-y-3 text-sm text-foreground">
                  <p><strong>Group:</strong> 5 members contributing 10,000 XAF monthly</p>
                  <p><strong>Pot:</strong> 50,000 XAF per cycle</p>
                  <p><strong>Duration:</strong> 5 months (each member receives once)</p>
                  <p><strong>Late interest:</strong> 5% — if you're late, you pay 10,500 XAF instead of 10,000</p>
                  <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="font-semibold text-primary">
                      If you pay on time every month: +25 credit points over 5 months
                    </p>
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[hsl(260,60%,40%)] to-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Join the Digital Njangi Revolution</h2>
            <p className="text-xl mb-8 opacity-90 max-w-xl mx-auto">
              Create or join a group today. Build wealth together while building your credit score.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
                  Create a Group
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/crediq">
                <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-white/30 text-white bg-transparent hover:bg-white/10">
                  Learn About CrediQ
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
};

export default NjangiInfo;
