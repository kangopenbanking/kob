import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Server, Clock, Shield, Globe } from "lucide-react";

export default function Infrastructure() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Architecture</Badge>
        <h1 className="text-4xl font-bold mb-4">Infrastructure</h1>
        <p className="text-xl text-muted-foreground">Production infrastructure designed for financial-grade reliability, scalability, and regulatory compliance.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Server className="h-6 w-6 text-primary" /><CardTitle>Architecture Overview</CardTitle></div></CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
Production Infrastructure
═════════════════════════

  ┌───────────────────────────────────────────┐
  │  CDN & Edge Network                       │
  │  → Global edge caching                    │
  │  → DDoS protection                        │
  │  → WAF (Web Application Firewall)         │
  └────────────────┬──────────────────────────┘
                   ↓
  ┌───────────────────────────────────────────┐
  │  API Gateway                              │
  │  → Rate limiting (per-client)             │
  │  → OAuth 2.0 + mTLS authentication       │
  │  → Request validation                     │
  │  → Load balancing                         │
  └────────────────┬──────────────────────────┘
                   ↓
  ┌───────────────────────────────────────────┐
  │  Edge Functions (200+ serverless)         │
  │  → Auto-scaling to 5,000+ TPS            │
  │  → Isolated execution environment         │
  │  → <50ms cold start                       │
  └────────────────┬──────────────────────────┘
                   ↓
  ┌───────────────────────────────────────────┐
  │  PostgreSQL (Primary + Read Replicas)     │
  │  → Row-Level Security on all tables       │
  │  → Point-in-time recovery (PITR)          │
  │  → Automated daily backups                │
  └───────────────────────────────────────────┘`}
              </pre>
            </div>
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader><div className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Availability</CardTitle></div></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Target SLA:</strong> 99.95% uptime</p>
              <p><strong>RTO:</strong> &lt; 15 minutes</p>
              <p><strong>RPO:</strong> &lt; 5 minutes</p>
              <p><strong>Monitoring:</strong> Real-time health checks every 30s</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Security</CardTitle></div></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Encryption:</strong> TLS 1.3 in transit, AES-256 at rest</p>
              <p><strong>Authentication:</strong> OAuth 2.0 + FAPI + mTLS</p>
              <p><strong>Secrets:</strong> Vault-managed rotation</p>
              <p><strong>Audit:</strong> Immutable audit logs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center gap-3"><Globe className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Scalability</CardTitle></div></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Capacity:</strong> 5,000+ TPS tested</p>
              <p><strong>Auto-scaling:</strong> Serverless edge functions</p>
              <p><strong>Database:</strong> Connection pooling + read replicas</p>
              <p><strong>Caching:</strong> Response cache at gateway layer</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
