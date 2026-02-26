import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";

export default function RiskDisclosure() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Investors</Badge>
        <h1 className="text-4xl font-bold mb-4">Risk Disclosure</h1>
        <p className="text-xl text-muted-foreground">Transparent assessment of technical, regulatory, and operational risks with mitigation strategies.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-6">
        {[
          { category: "Processor Dependency", risk: "Reliance on Stripe and Flutterwave for payment processing. Outage or partnership termination would impact service.", mitigation: "Multi-processor architecture allows failover. Internal ledger maintains state independently. Active evaluation of additional processors.", severity: "High" },
          { category: "Regulatory", risk: "CEMAC/COBAC regulatory changes could impact licensing requirements or operational scope.", mitigation: "Active regulatory monitoring. Legal counsel in Cameroon and Canada. Compliance team dedicated to regulatory change management.", severity: "Medium" },
          { category: "Currency Risk", risk: "XAF peg to EUR is stable but CEMAC monetary policy changes could impact operations.", mitigation: "Multi-currency support. Real-time FX rate management. Settlement in local currency reduces exposure.", severity: "Low" },
          { category: "Cybersecurity", risk: "Financial platforms are high-value targets for cyberattacks.", mitigation: "Multi-layer fraud engine. PCI DSS compliance. WAF, DDoS protection. Immutable audit logs. Incident response plan.", severity: "Medium" },
          { category: "Market", risk: "Low banking penetration (15%) in Cameroon limits addressable market.", mitigation: "Mobile money integration addresses 70%+ of financial transactions. Platform designed for mobile-first users.", severity: "Medium" },
          { category: "Scaling", risk: "Rapid growth could strain infrastructure and support capacity.", mitigation: "Serverless architecture auto-scales. Database connection pooling. Load tested to 5,000+ TPS.", severity: "Low" },
        ].map((r) => (
          <Card key={r.category}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-primary" /><CardTitle className="text-lg">{r.category}</CardTitle></div>
                <Badge variant={r.severity === "High" ? "destructive" : r.severity === "Medium" ? "default" : "secondary"}>{r.severity}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Risk:</strong> {r.risk}</p>
              <p><strong>Mitigation:</strong> {r.mitigation}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
