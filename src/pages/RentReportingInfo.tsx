import React from "react";
import { Link } from "react-router-dom";
import rentsBanner from "@/assets/rents-kob-1.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home, ArrowRight, CheckCircle, TrendingUp, Shield, Clock,
  AlertTriangle, Hash, CreditCard, BarChart3, Bell
} from "lucide-react";
import { Helmet } from "react-helmet-async";

const RentReportingInfo = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Rent Reporting — Build Credit with Rent | Kang Open Banking</title>
        <meta name="description" content="Turn your rent payments into credit history. Get a unique KRENTS reference, pay your landlord directly, and watch your CrediQ score grow with every on-time payment." />
        <link rel="canonical" href="https://kangopenbanking.com/rent-reporting" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Rent Reporting — Build Credit Through Rent",
          "description": "Turn monthly rent payments into verifiable credit history. Get a unique KRENTS reference code and build your CrediQ score with every on-time payment.",
          "url": "https://kangopenbanking.com/rent-reporting",
          "brand": { "@type": "Brand", "name": "Kang Open Banking" },
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "XAF", "availability": "https://schema.org/InStock" }
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden py-32 md:py-40">
        <img src={rentsBanner} alt="" className="absolute inset-0 w-full h-full object-cover object-center" aria-hidden="true" />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge variant="outline" className="mb-6 border-white/30 bg-white/10 text-white px-4 py-2">
              <Home className="h-4 w-4 inline mr-2" />
              Credit Building Through Rent
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Rent Reporting
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-4 max-w-2xl mx-auto">
              Your rent payments already happen. Now make them count toward your credit score.
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 border border-white/20 mb-8">
              <Hash className="h-5 w-5" />
              <span className="font-mono text-lg font-bold">KRENTS</span>
              <span className="text-white/60">· Your unique rent ID</span>
            </div>
            <div className="block">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
                  Set Up Rent Reporting
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How KRENTS Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How KRENTS Works</h2>
              <p className="text-xl text-muted-foreground">A unique reference for every tenant</p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Sign Up & Set Up Rent Plan</h3>
                    <p className="text-muted-foreground">Create a rent plan in Piggy Bank with your landlord's details and payment schedule.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-accent">2</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Get Your KRENTS Reference</h3>
                    <p className="text-muted-foreground">A unique code like <strong className="font-mono">KRENTS4821</strong> is auto-generated and permanently linked to your account.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Pay Rent On Schedule</h3>
                    <p className="text-muted-foreground">Funds move directly from you to your landlord. Only successful payments are reported.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-accent">4</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">Credit Score Improves</h3>
                    <p className="text-muted-foreground">Each on-time payment adds +5 to +10 points to your CrediQ score, reported automatically.</p>
                  </div>
                </div>
              </div>

              <Card className="p-8 bg-gradient-to-br from-muted/50 to-muted/20 border-2">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 border border-primary/20">
                    <Hash className="h-6 w-6 text-primary" />
                    <span className="font-mono text-2xl font-bold text-primary">KRENTS4821</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Your permanent rent reference</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-background border">
                    <span className="text-sm text-muted-foreground">Tenant</span>
                    <span className="font-medium">John D.</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-background border">
                    <span className="text-sm text-muted-foreground">Monthly Rent</span>
                    <span className="font-bold">150,000 XAF</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-background border">
                    <span className="text-sm text-muted-foreground">Frequency</span>
                    <span className="font-medium">Monthly</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-sm font-medium">Credit Impact</span>
                    <span className="font-bold text-primary">+10 pts / payment</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Important Warning */}
      <section className="py-16 bg-destructive/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="p-8 border-destructive/30">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
                <div>
                  <h3 className="text-xl font-bold mb-3">Important: Read Before Setting Up</h3>
                  <p className="text-muted-foreground mb-4">
                    Rent reporting is a powerful credit-building tool, but it works both ways:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span><strong>On-time payments:</strong> +5 to +10 credit points per payment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Clock className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                      <span><strong>Late payments:</strong> -10 to -25 credit points (scales with days late)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      <span><strong>Missed payments:</strong> -30 credit points per occurrence</span>
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4">
                    Only proceed if you're confident in making regular rent payments. This cannot be undone — your KRENTS reference is permanent.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Monthly Reports */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Bell className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Monthly Credit Reports</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Every month, you'll receive a detailed credit report via push notification and email with your payment performance, on-time percentage, and score delta.
            </p>
            <Card className="p-6 bg-muted/50 max-w-md mx-auto text-left">
              <p className="text-sm font-medium mb-2">📬 Monthly Credit Report</p>
              <p className="text-sm text-muted-foreground italic">
                "You made 1/1 rent payments on time (100%). Your score improved by +10 this month. Keep it up!"
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-accent to-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Make Your Rent Count</h2>
          <p className="text-xl mb-8 opacity-90 max-w-xl mx-auto">
            Turn your largest monthly expense into a credit-building opportunity.
          </p>
          <Link to="/auth">
            <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary hover:bg-white/90">
              Start Rent Reporting
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default RentReportingInfo;
