import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle } from "lucide-react";

export default function ComplianceStatus() {
  const items = [
    { area: "AML/CFT", status: "Implemented", details: "Sanctions screening, PEP checks, STR workflow, transaction monitoring" },
    { area: "KYC/KYB", status: "Implemented", details: "3-tier individual KYC, business KYB with UBO identification" },
    { area: "PCI DSS", status: "Compliant", details: "Card data never stored — tokenized via Stripe. Annual attestation." },
    { area: "COBAC Reporting", status: "Framework Ready", details: "Reporting templates prepared. Quarterly submission structure defined." },
    { area: "Data Protection", status: "Implemented", details: "AES-256 encryption at rest, TLS 1.3 in transit, data retention policies" },
    { area: "Audit Trail", status: "Implemented", details: "Immutable audit logs with IP, device, geolocation for all operations" },
    { area: "Consent Management", status: "Implemented", details: "AISP consent lifecycle with expiry, revocation, and granular permissions" },
    { area: "Fraud Prevention", status: "Implemented", details: "5-layer fraud engine with risk scoring, velocity checks, processor signals" },
  ];
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Investors</Badge>
        <h1 className="text-4xl font-bold mb-4">Compliance Status</h1>
        <p className="text-xl text-muted-foreground">Current compliance posture across regulatory and security domains.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.area}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><h3 className="font-semibold">{item.area}</h3><Badge variant="outline">{item.status}</Badge></div>
                  <p className="text-sm text-muted-foreground">{item.details}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
