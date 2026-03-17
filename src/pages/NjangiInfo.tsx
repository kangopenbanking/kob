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
import njangiBanner from "@/assets/njangi_kob.png";

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
      <section className="relative overflow-hidden py-24">
        <img src={njangiBanner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/60" />
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

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How Njangi Works</h2>
              <p className="text-xl text-muted-foreground">A time-honored tradition, modernized</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: UserPlus, title: "Form a Group", desc: "Invite 3–10 friends or family members to join your Njangi circle.", color: "text-primary" },
                { icon: Coins, title: "Everyone Contributes", desc: "Each member pays a fixed amount every week or month into the shared pot.", color: "text-accent" },
                { icon: Users, title: "One Person Collects", desc: "Every cycle, one member receives the total pot. The rotation continues until everyone has received.", color: "text-primary" },
                { icon: TrendingUp, title: "Credit Builds", desc: "On-time contributions are reported to CrediQ. Your credit score grows with each payment.", color: "text-accent" },
              ].map((step, i) => (
                <Card key={i} className="p-6 text-center hover:shadow-lg transition-shadow">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <step.icon className={`h-7 w-7 ${step.color}`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Key Features</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Shuffle className="h-8 w-8 text-primary" />
                  <h3 className="text-xl font-bold">Random Rotation</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  The system randomly selects who receives the pot each cycle. No favoritism — the algorithm ensures everyone receives before any repeats.
                </p>
                <Badge variant="outline">Fair & Transparent</Badge>
              </Card>

              <Card className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Hand className="h-8 w-8 text-accent" />
                  <h3 className="text-xl font-bold">Manual Selection</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  The group creator can manually choose the recipient each cycle. Ideal for groups with specific needs like emergency funds.
                </p>
                <Badge variant="outline">Flexible</Badge>
              </Card>

              <Card className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  <h3 className="text-xl font-bold">Late Interest</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Groups can set a late interest rate (e.g., 5%) that's automatically applied when members pay late. This incentivizes on-time contributions.
                </p>
                <Badge variant="outline" className="border-yellow-500 text-yellow-700">Configurable</Badge>
              </Card>

              <Card className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <h3 className="text-xl font-bold">Credit Reporting</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Every contribution — on-time, late, or missed — is recorded as a credit event. Build a strong financial history through group participation.
                </p>
                <Badge variant="outline" className="border-primary text-primary">CrediQ Integrated</Badge>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Impact */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Credit Score Impact</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 bg-primary/5 border-primary/20 text-center">
                <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">On-Time</h3>
                <p className="text-3xl font-bold text-primary mb-1">+3 to +5</p>
                <p className="text-sm text-muted-foreground">per contribution</p>
              </Card>

              <Card className="p-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-center">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">Late</h3>
                <p className="text-3xl font-bold text-yellow-600 mb-1">-5 to -15</p>
                <p className="text-sm text-muted-foreground">+ late interest from group</p>
              </Card>

              <Card className="p-6 bg-destructive/5 border-destructive/20 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">Missed</h3>
                <p className="text-3xl font-bold text-destructive mb-1">-25</p>
                <p className="text-sm text-muted-foreground">per missed cycle</p>
              </Card>
            </div>

            {/* Example */}
            <Card className="mt-10 p-8 bg-gradient-to-br from-muted/50 to-muted/20">
              <h3 className="text-xl font-bold mb-4">📊 Example Scenario</h3>
              <div className="space-y-3 text-sm">
                <p><strong>Group:</strong> 5 members contributing 10,000 XAF monthly</p>
                <p><strong>Pot:</strong> 50,000 XAF per cycle</p>
                <p><strong>Duration:</strong> 5 months (each member receives once)</p>
                <p><strong>Late interest:</strong> 5% — if you're late, you pay 10,500 XAF instead of 10,000</p>
                <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="font-semibold text-primary">
                    If you pay on time every month: +25 credit points over 5 months
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[hsl(260,60%,40%)] to-primary text-white">
        <div className="container mx-auto px-4 text-center">
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
              <Button size="lg" variant="outline" className="text-lg px-10 py-6 border-white/30 text-white hover:bg-white/10">
                Learn About CrediQ
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default NjangiInfo;
