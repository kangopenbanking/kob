import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function AGradeStatus() {
  const categories = [
    { name: "API Documentation", score: 97, items: ["100% endpoint coverage", "OpenAPI 3.1.0 validation pass", "Postman collection synced", "Error codes enumerated", "Webhook events catalogued"] },
    { name: "Security", score: 95, items: ["OAuth 2.0 + mTLS", "PCI DSS compliant", "TLS 1.3 enforced", "HMAC webhook verification", "Idempotency-Key mandatory"] },
    { name: "Compliance", score: 88, items: ["AML/CFT framework", "Tiered KYC/KYB", "Sanctions screening", "PEP checks", "Audit trail"] },
    { name: "Infrastructure", score: 90, items: ["99.95% SLA target", "RTO < 15 min", "Auto-scaling serverless", "Immutable audit logs", "PITR backups"] },
    { name: "Fraud Prevention", score: 90, items: ["5-layer fraud engine", "Risk scoring API", "Velocity checks", "Device fingerprinting", "Processor signal fusion"] },
    { name: "Developer Experience", score: 96, items: ["Interactive API explorer", "Sandbox environment", "SDK libraries", "Code examples", "Webhook testing tools"] },
  ];
  const overall = Math.round(categories.reduce((a, c) => a + c.score, 0) / categories.length);
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Certification</Badge>
        <h1 className="text-4xl font-bold mb-4">A-Grade Certification Status</h1>
        <p className="text-xl text-muted-foreground">Production readiness assessment across all platform domains.</p>
      </div>
      <Separator className="my-8" />
      <Card className="mb-8 border-2 border-primary">
        <CardContent className="pt-6 text-center">
          <p className="text-6xl font-bold text-primary">{overall}/100</p>
          <Badge className="mt-4 text-lg px-4 py-1">{overall >= 90 ? "A-GRADE CERTIFIED" : overall >= 80 ? "CONDITIONAL PASS" : "IN PROGRESS"}</Badge>
          <p className="text-muted-foreground mt-4">Last assessed: February 2026</p>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-6">
        {categories.map((cat) => (
          <Card key={cat.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{cat.name}</CardTitle>
                <Badge variant={cat.score >= 95 ? "default" : cat.score >= 85 ? "secondary" : "outline"}>{cat.score}/100</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {cat.items.map((item) => (
                  <li key={item} className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0" />{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
