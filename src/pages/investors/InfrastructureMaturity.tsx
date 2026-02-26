import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function InfrastructureMaturity() {
  const scores = [
    { domain: "API Documentation", score: 97, status: "A-Grade" },
    { domain: "Security & Authentication", score: 95, status: "Production" },
    { domain: "Payment Processing", score: 93, status: "Production" },
    { domain: "Fraud Detection", score: 90, status: "Production" },
    { domain: "Ledger & Reconciliation", score: 92, status: "Production" },
    { domain: "Regulatory Compliance", score: 88, status: "Framework Ready" },
    { domain: "Multi-Country Readiness", score: 75, status: "Expansion Phase" },
    { domain: "Disaster Recovery", score: 85, status: "Production" },
    { domain: "Developer Experience", score: 96, status: "A-Grade" },
    { domain: "Monitoring & Observability", score: 88, status: "Production" },
  ];
  const overall = Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Investors</Badge>
        <h1 className="text-4xl font-bold mb-4">Infrastructure Maturity</h1>
        <p className="text-xl text-muted-foreground">Quantitative maturity assessment across 10 infrastructure domains.</p>
      </div>
      <Separator className="my-8" />
      <Card className="mb-8"><CardContent className="pt-6 text-center"><p className="text-5xl font-bold text-primary">{overall}/100</p><p className="text-muted-foreground mt-2">Overall Infrastructure Maturity Score</p></CardContent></Card>
      <div className="space-y-3">
        {scores.map((s) => (
          <Card key={s.domain}><CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div><p className="font-semibold">{s.domain}</p><Badge variant="outline" className="mt-1">{s.status}</Badge></div>
              <div className="text-right"><p className="text-2xl font-bold">{s.score}</p><p className="text-xs text-muted-foreground">/100</p></div>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${s.score}%` }} /></div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
