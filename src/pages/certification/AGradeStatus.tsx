import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, AlertTriangle, Shield, ExternalLink } from "lucide-react";

const fapiChecklist = [
  { requirement: "PKCE mandatory on authorization requests", standard: "FAPI 1.0 Adv Section 5.2.2", status: "certified" },
  { requirement: "mTLS client certificate binding", standard: "FAPI 1.0 Adv Section 5.2.2.1", status: "certified" },
  { requirement: "Pushed Authorization Requests (PAR)", standard: "RFC 9126", status: "certified" },
  { requirement: "JWT-Secured Authorization Requests (JAR)", standard: "RFC 9101", status: "certified" },
  { requirement: "Nonce required in authorization", standard: "FAPI 1.0 Adv Section 5.2.2", status: "certified" },
  { requirement: "Detached JWS signatures on responses", standard: "OBIE v4.0.1", status: "certified" },
  { requirement: "x-fapi-interaction-id header propagation", standard: "FAPI 1.0 Section 6.2.1", status: "certified" },
  { requirement: "Token endpoint supports PKCE + mTLS", standard: "FAPI 1.0 Adv Section 5.2.2", status: "certified" },
  { requirement: "RFC 7807 problem+json error responses", standard: "RFC 7807", status: "certified" },
  { requirement: "OIDC Discovery with 19 properties", standard: "OpenID Connect Discovery 1.0", status: "certified" },
  { requirement: "OpenID Foundation formal certification", standard: "FAPI 1.0 Advanced", status: "pending_verification" },
  { requirement: "Conformance suite test pass (all profiles)", standard: "OpenID FAPI Conformance", status: "pending_verification" },
];

const cobacChecklist = [
  { requirement: "COBAC registration (COBAC-R-2024/0847)", standard: "COBAC Regulation 01/CEMAC", status: "certified" },
  { requirement: "BEAC compliance alignment", standard: "BEAC Regulation 02/18", status: "certified" },
  { requirement: "AML/CFT framework implemented", standard: "FATF Recommendations", status: "certified" },
  { requirement: "Tiered KYC/KYB verification", standard: "COBAC Instruction 01/2024", status: "certified" },
  { requirement: "Sanctions screening integration", standard: "UN/EU Sanctions Lists", status: "certified" },
  { requirement: "COBAC transaction reporting (camt.052/054)", standard: "ISO 20022", status: "certified" },
  { requirement: "Cross-border remittance reporting", standard: "BEAC Regulation", status: "certified" },
  { requirement: "Quarterly compliance audit", standard: "COBAC Instruction 03/2024", status: "in_progress" },
];

const categories = [
  { name: "API Documentation", score: 97, items: ["100% endpoint coverage", "OpenAPI 3.1.0 validation pass", "Postman collection synced", "Error codes enumerated", "Webhook events catalogued"] },
  { name: "Security", score: 95, items: ["OAuth 2.0 + mTLS", "PCI DSS compliant", "TLS 1.3 enforced", "HMAC webhook verification", "Idempotency-Key mandatory"] },
  { name: "Compliance", score: 91, items: ["AML/CFT framework", "Tiered KYC/KYB", "Sanctions screening", "PEP checks", "Audit trail", "COBAC registered"] },
  { name: "Infrastructure", score: 90, items: ["99.95% SLA target", "RTO < 15 min", "Auto-scaling serverless", "Immutable audit logs", "PITR backups"] },
  { name: "Fraud Prevention", score: 90, items: ["5-layer fraud engine", "Risk scoring API", "Velocity checks", "Device fingerprinting", "Processor signal fusion"] },
  { name: "Developer Experience", score: 96, items: ["Interactive API explorer", "Sandbox environment", "SDK libraries (Node, Python, PHP)", "Code examples (9 languages)", "Webhook testing tools"] },
];

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "certified") {
    return (
      <Badge variant="outline" className="text-xs text-green-600 border-green-300 gap-1">
        <CheckCircle className="h-3 w-3" /> Certified
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 gap-1">
        <Clock className="h-3 w-3" /> In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground border-muted gap-1">
      <AlertTriangle className="h-3 w-3" /> Pending Verification
    </Badge>
  );
};

export default function AGradeStatus() {
  const overall = Math.round(categories.reduce((a, c) => a + c.score, 0) / categories.length);
  const fapiCertified = fapiChecklist.filter(c => c.status === "certified").length;
  const cobacCertified = cobacChecklist.filter(c => c.status === "certified").length;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Certification</Badge>
        <h1 className="text-4xl font-bold mb-4">A-Grade Certification Status</h1>
        <p className="text-xl text-muted-foreground">Production readiness assessment and regulatory certification tracker.</p>
      </div>
      <Separator className="my-8" />

      {/* Overall Score */}
      <Card className="mb-8 border-2 border-primary">
        <CardContent className="pt-6 text-center">
          <p className="text-6xl font-bold text-primary">{overall}/100</p>
          <Badge className="mt-4 text-lg px-4 py-1">{overall >= 90 ? "A-GRADE CERTIFIED" : overall >= 80 ? "CONDITIONAL PASS" : "IN PROGRESS"}</Badge>
          <p className="text-muted-foreground mt-4">Last assessed: April 2026</p>
        </CardContent>
      </Card>

      {/* FAPI 1.0 Certification Tracker */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">FAPI 1.0 Advanced Certification</h2>
        </div>
        <Card className="border border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">OpenID Foundation FAPI Compliance</CardTitle>
              <Badge variant="outline" className="text-xs">{fapiCertified}/{fapiChecklist.length} certified</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Banks should verify formal OpenID Foundation certification completion independently.
              <a href="https://openid.net/certification/" target="_blank" rel="noopener noreferrer" className="text-primary ml-1 inline-flex items-center gap-1">
                OpenID Certification Directory <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {fapiChecklist.map((item) => (
                <div key={item.requirement} className="flex items-center justify-between rounded-lg border border-border/20 px-3 py-2">
                  <div className="flex-1">
                    <span className="text-sm">{item.requirement}</span>
                    <span className="text-xs text-muted-foreground ml-2">({item.standard})</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* COBAC/BEAC Compliance */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">COBAC / BEAC Regulatory Compliance</h2>
        </div>
        <Card className="border border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">CEMAC Regional Compliance</CardTitle>
              <Badge variant="outline" className="text-xs">{cobacCertified}/{cobacChecklist.length} certified</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cobacChecklist.map((item) => (
                <div key={item.requirement} className="flex items-center justify-between rounded-lg border border-border/20 px-3 py-2">
                  <div className="flex-1">
                    <span className="text-sm">{item.requirement}</span>
                    <span className="text-xs text-muted-foreground ml-2">({item.standard})</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Scores */}
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
