import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Server, Shield, BarChart3, TrendingUp } from "lucide-react";

export default function TechnicalOverview() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Investors</Badge>
        <h1 className="text-4xl font-bold mb-4">Technical Overview</h1>
        <p className="text-xl text-muted-foreground">Architecture, capabilities, and technical maturity assessment for investor due diligence.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { label: "Edge Functions", value: "200+", icon: Server },
            { label: "Database Tables", value: "80+", icon: BarChart3 },
            { label: "API Endpoints", value: "160+", icon: TrendingUp },
            { label: "Security Policies", value: "100+ RLS", icon: Shield },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-6 text-center"><s.icon className="h-8 w-8 text-primary mx-auto mb-2" /><p className="text-2xl font-bold">{s.value}</p><p className="text-sm text-muted-foreground">{s.label}</p></CardContent></Card>
          ))}
        </div>
        <Card><CardHeader><CardTitle>Revenue Model</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">Transaction Fees</h4><p>Percentage + fixed fee per transaction across all payment channels (card, mobile money, bank transfer, PayPal).</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">API Subscription</h4><p>Tiered API access plans based on request volume and feature access.</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">Value-Added Services</h4><p>Credit scoring API, fraud detection, reconciliation, and white-label payment facilitation.</p></div>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Technology Stack</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { area: "Frontend", tech: "React, TypeScript, Tailwind CSS, Vite" },
                { area: "Backend", tech: "Edge Functions (Deno), PostgreSQL, Row-Level Security" },
                { area: "Payments", tech: "Stripe (Cards), Flutterwave (Mobile Money/Bank), PayPal" },
                { area: "Security", tech: "OAuth 2.0, mTLS, HMAC-SHA256, AES-256, PCI DSS" },
              ].map((t) => (
                <div key={t.area} className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-1">{t.area}</h4><p>{t.tech}</p></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
