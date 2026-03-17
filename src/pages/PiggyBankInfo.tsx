import React from "react";
import { Link } from "react-router-dom";
import piggyBanner from "@/assets/kob-12.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PiggyBank, Home, ArrowRight, CheckCircle, TrendingUp, Shield, Clock,
  Calendar, AlertTriangle, Zap, BarChart3, Building2, Search, Lock, Target
} from "lucide-react";
import { Helmet } from "react-helmet-async";

const PiggyBankInfo = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Piggy Bank — Savings & Rent Plans | Kang Open Banking</title>
        <meta name="description" content="Explore savings products from banks and credit unions, or create personal savings plans. Build your credit score with every on-time payment through Kang's Piggy Bank." />
        <link rel="canonical" href="https://kangopenbanking.com/piggybank" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Piggy Bank — Savings & Rent Plans",
          "description": "Explore savings products from Cameroonian banks and credit unions, or create personal savings plans. Build your credit score with every on-time payment.",
          "url": "https://kangopenbanking.com/piggybank",
          "brand": { "@type": "Brand", "name": "Kang Open Banking" },
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "XAF", "availability": "https://schema.org/InStock" }
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden py-24">
        <img src={piggyBanner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-primary-foreground">
            <Badge variant="outline" className="mb-6 border-white/30 bg-white/10 text-white px-4 py-2">
              <PiggyBank className="h-4 w-4 inline mr-2" />
              Financial Planning Tool
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Piggy Bank
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
              Explore savings from real banks, create personal goals, and build your credit score — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/crediq">
                <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-white/30 text-white bg-transparent hover:bg-white/10">
                  Learn About CrediQ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How Piggy Bank Works</h2>
              <p className="text-xl text-muted-foreground">Three simple steps to build savings and credit</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-8 text-center hover:shadow-lg transition-shadow">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">1. Explore or Create</h3>
                <p className="text-muted-foreground">
                  Browse savings products from banks and credit unions, or create your own personal savings plan with custom goals.
                </p>
              </Card>

              <Card className="p-8 text-center hover:shadow-lg transition-shadow">
                <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold mb-3">2. Save Consistently</h3>
                <p className="text-muted-foreground">
                  Make regular deposits — daily, weekly, or monthly. Track your progress with visual indicators and stay on schedule.
                </p>
              </Card>

              <Card className="p-8 text-center hover:shadow-lg transition-shadow">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">3. Build Credit</h3>
                <p className="text-muted-foreground">
                  Every on-time payment is reported to CrediQ. Your score improves automatically over time.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Two Categories */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Two Ways to Save</h2>
              <p className="text-xl text-muted-foreground">Choose the approach that fits your needs</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Bank Savings */}
              <Card className="p-8 border-2 border-primary/20 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Bank Savings</h3>
                    <p className="text-sm text-muted-foreground">From financial institutions</p>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>Browse savings products from real banks & credit unions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>Compare interest rates, lock-in periods, and features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>Apply directly from the app — no branch visit needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="font-semibold">Earn interest on your deposits</span>
                  </li>
                </ul>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-sm text-muted-foreground">
                    <strong>Product Types:</strong> Fixed deposits, goal savings, high-yield accounts, kids savings — each with different rates and terms.
                  </p>
                </div>
              </Card>

              {/* Personal Savings */}
              <Card className="p-8 border-2 border-accent/20 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <PiggyBank className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Personal Savings</h3>
                    <p className="text-sm text-muted-foreground">Goal-based plans</p>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span>Create unlimited custom savings plans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span>Set targets, installment amounts, and schedules</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span>Track progress with visual bars and payment counters</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span className="font-semibold">+3 to +5 credit points per on-time payment</span>
                  </li>
                </ul>
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/10">
                  <p className="text-sm text-muted-foreground">
                    <strong>Credit Impact:</strong> On-time savings payments demonstrate financial discipline and consistently improve your CrediQ score.
                  </p>
                </div>
              </Card>
            </div>

            {/* Rent Plan add-on */}
            <Card className="mt-8 p-8 border-2 border-accent/20 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Home className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Rent Reporting</h3>
                  <Badge className="bg-accent">KRENTS****</Badge>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span>Unique <strong className="font-mono">KRENTS</strong> reference ID assigned automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span>Funds transfer directly from tenant to landlord</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <span className="font-semibold">+5 to +10 credit points per on-time rent payment</span>
                  </li>
                </ul>
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      <strong>Warning:</strong> Missed rent payments result in <strong>-30 points</strong>. Only set up rent reporting if you're confident in making regular payments.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Credit Score Impact */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Credit Score Impact</h2>
              <p className="text-xl text-muted-foreground">How Piggy Bank affects your CrediQ rating</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <TrendingUp className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold text-lg mb-2">On-Time Payment</h3>
                <p className="text-3xl font-bold text-primary mb-1">+3 to +10</p>
                <p className="text-sm text-muted-foreground">Savings: +3 to +5 · Rent: +5 to +10</p>
              </Card>

              <Card className="p-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                <Clock className="h-8 w-8 text-yellow-600 mb-3" />
                <h3 className="font-bold text-lg mb-2">Late Payment</h3>
                <p className="text-3xl font-bold text-yellow-600 mb-1">-5 to -25</p>
                <p className="text-sm text-muted-foreground">Scales with days late</p>
              </Card>

              <Card className="p-6 bg-destructive/5 border-destructive/20">
                <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
                <h3 className="font-bold text-lg mb-2">Missed Payment</h3>
                <p className="text-3xl font-bold text-destructive mb-1">-20 to -30</p>
                <p className="text-sm text-muted-foreground">Savings: -20 · Rent: -30</p>
              </Card>
            </div>

            <Card className="mt-8 p-6 bg-muted/50">
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 text-primary mt-1 shrink-0" />
                <div>
                  <h4 className="font-bold mb-1">Monthly Credit Reports</h4>
                  <p className="text-muted-foreground text-sm">
                    You'll receive a monthly credit report via push notification and email summarizing your payment performance, on-time percentage, and score changes.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Start Building Your Credit Today</h2>
          <p className="text-xl mb-8 opacity-90 max-w-xl mx-auto">
            Explore savings products from top institutions or create your own plan — and improve your CrediQ score with every payment.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
              Open Your Piggy Bank
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default PiggyBankInfo;
