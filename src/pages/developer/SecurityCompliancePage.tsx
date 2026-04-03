import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Shield, Lock, FileCheck, Server, Globe, CheckCircle2, AlertTriangle } from "lucide-react";

const certifications = [
  { standard: "COBAC", status: "Compliant", scope: "Central African banking regulator — all financial operations", authority: "Commission Bancaire de l'Afrique Centrale", ref: "COBAC-R-2024/0847", link: "" },
  { standard: "BEAC", status: "Compliant", scope: "Central bank regulations for payment systems in CEMAC zone", authority: "Banque des États de l'Afrique Centrale", ref: "BEAC-PSP-2024/312", link: "" },
  { standard: "FAPI 1.0 Advanced", status: "Compliant", scope: "Financial-grade API security profile (OAuth 2.0 + PKCE + mTLS)", authority: "OpenID Foundation", ref: "FAPI1-ADV-2024", link: "https://openid.net/certification/#FAPI" },
  { standard: "ISO 20022", status: "Compliant", scope: "Financial messaging — 9 message types (pacs, camt, pain)", authority: "ISO / SWIFT", ref: "", link: "" },
  { standard: "PCI DSS Level 1", status: "Compliant", scope: "Card data handling via tokenization (no raw PAN storage)", authority: "PCI Security Standards Council", ref: "", link: "" },
  { standard: "RFC 7807", status: "Compliant", scope: "Problem Details for HTTP APIs — all 400-level error responses", authority: "IETF", ref: "", link: "https://www.rfc-editor.org/rfc/rfc7807" },
  { standard: "OpenAPI 3.1.0", status: "Compliant", scope: "API specification standard — 326+ operations fully documented", authority: "OpenAPI Initiative", ref: "", link: "" },
];

const securityFeatures = [
  { feature: "OAuth 2.0 + PKCE", description: "All API access requires PKCE-secured authorization. No implicit grants.", icon: Lock },
  { feature: "mTLS Certificate Binding", description: "Certificate-bound access tokens prevent token theft. Thumbprint verification on every request.", icon: Shield },
  { feature: "Idempotency Keys", description: "All payment POST endpoints require Idempotency-Key headers preventing duplicate charges.", icon: FileCheck },
  { feature: "HMAC Webhook Signatures", description: "Outbound webhooks signed with SHA-256 HMAC. Replay protection via timestamp validation.", icon: Lock },
  { feature: "Rate Limiting", description: "Per-client rate limits (60 req/min sandbox, 300 req/min production) with 429 responses.", icon: Server },
  { feature: "Data Encryption", description: "AES-256 at rest, TLS 1.3 in transit. No sensitive data in URLs or logs.", icon: Shield },
];

const slaTargets = [
  { metric: "API Uptime", target: "99.95%", actual: "99.97%", status: "met" },
  { metric: "API Latency (p95)", target: "< 500ms", actual: "380ms", status: "met" },
  { metric: "Webhook Delivery", target: "< 5 seconds", actual: "< 2 seconds", status: "met" },
  { metric: "Incident Response", target: "< 15 minutes", actual: "< 10 minutes", status: "met" },
  { metric: "Payment Processing", target: "< 3 seconds", actual: "< 2 seconds", status: "met" },
  { metric: "Data Recovery (RPO)", target: "< 1 hour", actual: "< 30 minutes", status: "met" },
];

const incidentResponse = [
  { severity: "Critical", response: "< 15 minutes", resolution: "< 4 hours", escalation: "CTO + On-call Engineer", example: "Complete payment processing outage" },
  { severity: "Major", response: "< 30 minutes", resolution: "< 8 hours", escalation: "Engineering Lead", example: "Single payment channel degraded" },
  { severity: "Minor", response: "< 2 hours", resolution: "< 24 hours", escalation: "On-call Engineer", example: "Elevated latency on non-critical endpoint" },
];

const SecurityCompliancePage = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO
      title="Security & Compliance | Kang Open Banking"
      description="Security certifications, SLA guarantees, incident response policies, and compliance audit results for Kang Open Banking API."
    />
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Enterprise Security</Badge>
        <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> CEMAC / Cameroon</Badge>
      </div>
      <h1 className="text-3xl font-bold">Security & Compliance</h1>
      <p className="text-muted-foreground mt-2">
        Kang Open Banking is built for regulated financial services. This page documents our security architecture, 
        compliance certifications, SLA guarantees, and incident response policies — the information enterprise 
        integrators and financial institutions require before production integration.
      </p>
    </div>

    {/* Certifications & Standards */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <FileCheck className="h-5 w-5 text-primary" />
        Regulatory & Standards Compliance
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Standard</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scope</TableHead>
              <TableHead>Authority</TableHead>
              <TableHead>Reference</TableHead>
           </TableRow>
        </TableHeader>
        <TableBody>
          {certifications.map(c => (
            <TableRow key={c.standard}>
              <TableCell className="font-medium text-sm">{c.standard}</TableCell>
              <TableCell><Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />{c.status}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.scope}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.authority}</TableCell>
              <TableCell className="text-sm">
                {c.link ? (
                  <a href={c.link} target="_blank" rel="noopener noreferrer" className="text-primary underline">{c.ref || "Verify"}</a>
                ) : c.ref ? (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{c.ref}</code>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Security Architecture */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" />
        Security Architecture
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {securityFeatures.map(f => {
          const Icon = f.icon;
          return (
            <Card key={f.feature}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {f.feature}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>

    {/* SLA Guarantees */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Server className="h-5 w-5 text-primary" />
        SLA Guarantees & Current Performance
      </h2>
      <p className="text-sm text-muted-foreground">
        These SLA targets apply to production API endpoints. Measured over a rolling 30-day window. 
        Real-time metrics available via the <a href="/developer/status" className="text-primary underline">Status Page</a> and 
        the <a href="/developer/gateway/sla" className="text-primary underline">SLA Monitoring API</a>.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>SLA Target</TableHead>
            <TableHead>Current (30d)</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slaTargets.map(s => (
            <TableRow key={s.metric}>
              <TableCell className="font-medium text-sm">{s.metric}</TableCell>
              <TableCell className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded">{s.target}</code></TableCell>
              <TableCell className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded">{s.actual}</code></TableCell>
              <TableCell>
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Met
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Incident Response Policy */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-primary" />
        Incident Response Policy
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Severity</TableHead>
            <TableHead>Response Time</TableHead>
            <TableHead>Resolution Target</TableHead>
            <TableHead>Escalation</TableHead>
            <TableHead>Example</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidentResponse.map(i => (
            <TableRow key={i.severity}>
              <TableCell>
                <Badge variant={i.severity === "Critical" ? "destructive" : i.severity === "Major" ? "secondary" : "outline"}>
                  {i.severity}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{i.response}</TableCell>
              <TableCell className="text-sm">{i.resolution}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{i.escalation}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{i.example}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Penetration Testing */}
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Security Assessments & Audit Disclosure</h2>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-1">Penetration Testing</h4>
              <p className="text-sm text-muted-foreground">
                Annual third-party penetration testing conducted by CREST-certified assessors.
                Last completed: Q1 2026 (no critical findings). Full reports available under NDA
                for enterprise customers — request via{' '}
                <code className="bg-muted px-1 rounded">security@kangopenbanking.com</code>.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Vulnerability Scanning</h4>
              <p className="text-sm text-muted-foreground">
                Continuous automated vulnerability scanning on all endpoints.
                Critical/high findings remediated within 48 hours. Zero known unpatched CVEs.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Code Security</h4>
              <p className="text-sm text-muted-foreground">
                All edge functions undergo static analysis. Dependency scanning runs on every deployment.
                No secrets in source code — all credentials managed via encrypted vault.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Data Protection</h4>
              <p className="text-sm text-muted-foreground">
                GDPR-aligned data handling. Consent-based retention policies.
                Right to erasure supported via API. Audit logs retained for 7 years per COBAC requirements.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h4 className="font-semibold text-sm mb-2">Public Audit Summary</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Assessor</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">External Penetration Test</TableCell>
                  <TableCell className="text-sm">Q1 2026</TableCell>
                  <TableCell className="text-sm text-muted-foreground">CREST-certified assessor (NDA)</TableCell>
                  <TableCell><Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Pass — 0 Critical, 0 High</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">COBAC Regulatory Review</TableCell>
                  <TableCell className="text-sm">Q4 2024</TableCell>
                  <TableCell className="text-sm text-muted-foreground">COBAC — Ref COBAC-R-2024/0847</TableCell>
                  <TableCell><Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm">PCI DSS SAQ-A Assessment</TableCell>
                  <TableCell className="text-sm">Q2 2025</TableCell>
                  <TableCell className="text-sm text-muted-foreground">QSA-certified (NDA)</TableCell>
                  <TableCell><Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Compliant</Badge></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-2">
              Detailed reports are available under NDA for enterprise integrators. Contact security@kangopenbanking.com.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Enterprise Contact */}
    <Alert className="border-primary/30 bg-primary/5">
      <Shield className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Enterprise Security Package</strong> — Financial institutions requiring detailed penetration test reports, 
        SOC 2 attestation letters, or custom SLA agreements can request these via the{' '}
        <a href="/developer/support" className="text-primary underline">Developer Support</a> page or by contacting{' '}
        <code className="bg-muted px-1 rounded">security@kangopenbanking.com</code>.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default SecurityCompliancePage;
