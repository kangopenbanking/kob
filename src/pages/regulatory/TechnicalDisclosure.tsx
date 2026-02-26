import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Shield, Lock, FileCheck, RefreshCw } from "lucide-react";

export default function TechnicalDisclosure() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Badge variant="outline" className="mb-4">KOB-REG-007 — Phase 4: Technical System Disclosure</Badge>
      <h1 className="text-3xl font-bold mb-2">Technical System Architecture Disclosure</h1>
      <p className="text-muted-foreground mb-8">Regulator-facing technical description per COBAC Instruction No. 2006/01 on IT Risk Management</p>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /><CardTitle>1.0 System Architecture Overview</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-4 leading-relaxed">
          <p>The Kang Open Banking platform is a cloud-hosted, multi-tenant payment orchestration system. It provides secure APIs for financial institutions, merchants, and end-users to initiate payments, access account information, and manage financial operations.</p>
          <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto leading-relaxed">{`
  ┌──────────────────────────────────────────────────────────────┐
  │                    CLIENT APPLICATIONS                       │
  │   (Web Portal, Mobile App, Merchant Integration, API)        │
  └──────────────────────┬───────────────────────────────────────┘
                         │ HTTPS / TLS 1.3
  ┌──────────────────────▼───────────────────────────────────────┐
  │                    API GATEWAY LAYER                          │
  │   Authentication │ Rate Limiting │ Request Validation         │
  └──────────────────────┬───────────────────────────────────────┘
                         │
  ┌──────────────────────▼───────────────────────────────────────┐
  │                 APPLICATION SERVICES                          │
  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
  │  │Payment  │ │Settlement│ │ Fraud    │ │ Compliance       │ │
  │  │Engine   │ │Engine    │ │ Engine   │ │ Engine (AML/KYC) │ │
  │  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
  └──────────────────────┬───────────────────────────────────────┘
                         │
  ┌──────────────────────▼───────────────────────────────────────┐
  │                    DATA LAYER                                 │
  │   PostgreSQL (ACID) │ Redis (Cache) │ Object Storage          │
  │   Append-only Audit │ Encrypted at  │ Document/KYC            │
  │   Ledger            │ rest (AES-256)│ Storage                 │
  └──────────────────────────────────────────────────────────────┘
`}</pre>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /><CardTitle>2.0 Encryption & Security Model</CardTitle></div></CardHeader>
        <CardContent className="text-sm space-y-3">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2 font-medium text-muted-foreground">Security Layer</th><th className="text-left py-2">Implementation</th><th className="text-left py-2">Standard</th></tr></thead>
            <tbody className="divide-y">
              <tr><td className="py-2">Data in transit</td><td className="py-2">TLS 1.3 enforced on all API endpoints; HSTS enabled</td><td className="py-2">NIST SP 800-52r2</td></tr>
              <tr><td className="py-2">Data at rest</td><td className="py-2">AES-256-GCM encryption for database and object storage</td><td className="py-2">NIST SP 800-111</td></tr>
              <tr><td className="py-2">API authentication</td><td className="py-2">OAuth 2.0 with PKCE; client credentials for server-to-server</td><td className="py-2">RFC 6749 / RFC 7636</td></tr>
              <tr><td className="py-2">mTLS (Open Banking)</td><td className="py-2">Mutual TLS with X.509 certificates for TPP connections; certificate pinning</td><td className="py-2">RFC 8705</td></tr>
              <tr><td className="py-2">Webhook signing</td><td className="py-2">HMAC-SHA256 signature on all outbound webhooks</td><td className="py-2">Custom (industry standard)</td></tr>
              <tr><td className="py-2">Key management</td><td className="py-2">Secrets stored in vault service; rotated every 90 days; no secrets in code</td><td className="py-2">OWASP guidelines</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /><CardTitle>3.0 Audit Trail & Immutability</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-4">
          <p>All financial transactions and administrative actions are recorded in an append-only audit trail. This design ensures that no record can be altered or deleted after creation, providing regulators and auditors with a complete, tamper-evident history.</p>
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-2">3.1 Immutability Guarantees</h4>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              <li>Database-level: INSERT-only audit tables with no UPDATE or DELETE permissions granted to application roles</li>
              <li>Cryptographic: Each audit entry includes SHA-256 hash of previous entry, forming a hash chain</li>
              <li>Access control: Audit tables accessible only via read-only service accounts for reporting</li>
              <li>Retention: Minimum 10-year retention with automated archival to cold storage</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><div className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /><CardTitle>4.0 Reconciliation Methodology</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>A three-way reconciliation process runs daily to ensure the integrity of all financial data:</p>
          <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto leading-relaxed">{`
  Source A: Internal Ledger     Source B: Processor Records     Source C: Bank Statements
  (KOB double-entry system)    (Stripe/Flutterwave/PayPal)     (Settlement bank)
           │                            │                              │
           └────────────┬───────────────┘──────────────────────────────┘
                        │
                 ┌──────▼──────┐
                 │ Reconciler  │  Daily automated matching
                 │ Engine      │  by reference, amount, date
                 └──────┬──────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
         ┌────▼───┐ ┌───▼────┐ ┌─▼────────┐
         │Matched │ │Partial │ │Unmatched │
         │(auto)  │ │(review)│ │(escalate)│
         └────────┘ └────────┘ └──────────┘
`}</pre>
          <p className="text-xs text-muted-foreground">Unmatched items older than 48 hours are escalated to the Finance team. Items unresolved after 5 business days are reported to the CFO and documented in the monthly reconciliation report to COBAC.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>5.0 Idempotency Protection</CardTitle></div></CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3">
          <p>All payment initiation endpoints require an <code className="bg-muted px-1 rounded">Idempotency-Key</code> header. This mechanism prevents duplicate transactions caused by network retries, ensuring that a payment is processed exactly once regardless of how many times the request is submitted.</p>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground w-40">Key format</td><td className="py-2">UUID v4 (client-generated)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Storage</td><td className="py-2">Key → response mapping stored for 24 hours</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Behaviour</td><td className="py-2">Duplicate key returns cached response with 200 status (no re-processing)</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-muted-foreground">Regulatory benefit</td><td className="py-2">Eliminates risk of double-charging customers; supports audit trail accuracy</td></tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
