import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Lock, Key, RefreshCcw } from "lucide-react";

export default function SecurityReference() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">API Security</h1>
        <p className="text-xl text-muted-foreground">Authentication, encryption, and security best practices for API integration.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><div className="flex items-center gap-3"><Lock className="h-6 w-6 text-primary" /><CardTitle>Transport Security</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>TLS 1.3</strong> required for all API connections (TLS 1.2 accepted, TLS 1.0/1.1 rejected)</li>
              <li><strong>mTLS</strong> supported for AISP/PISP endpoints via client certificate binding</li>
              <li><strong>Certificate pinning</strong> recommended for mobile applications</li>
              <li><strong>HSTS</strong> enforced with 1-year max-age</li>
            </ul>
          </CardContent>
        </Card>
        <Card><CardHeader><div className="flex items-center gap-3"><Key className="h-6 w-6 text-primary" /><CardTitle>Authentication Methods</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">OAuth 2.0</h4><p>Authorization Code + PKCE for user-facing apps. Client Credentials for server-to-server.</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">API Keys</h4><p>Publishable keys for client-side. Secret keys for server-side. Environment-scoped.</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">mTLS</h4><p>Certificate-bound tokens for Open Banking AISP/PISP. FAPI 1.0 compliant.</p></div>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader><div className="flex items-center gap-3"><RefreshCcw className="h-6 w-6 text-primary" /><CardTitle>Key Rotation</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc list-inside space-y-2">
              <li>API keys can be rotated via the developer portal without downtime</li>
              <li>Old keys remain valid for 24 hours after rotation (grace period)</li>
              <li>Webhook signing secrets support dual-key verification during rotation</li>
              <li>OAuth client secrets can be rotated independently of client ID</li>
              <li>mTLS certificates should be rotated before expiry (60-day warning via API key notifications)</li>
            </ul>
          </CardContent>
        </Card>
        <Card><CardHeader><div className="flex items-center gap-3"><Shield className="h-6 w-6 text-primary" /><CardTitle>Data Protection</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Encryption at rest:</strong> AES-256 for all stored data</li>
              <li><strong>PCI DSS:</strong> Card data never stored — tokenized via Stripe</li>
              <li><strong>Data retention:</strong> Transaction data retained per regulatory requirements (5 years minimum)</li>
              <li><strong>Data residency:</strong> Primary storage in EU-based infrastructure</li>
              <li><strong>Access logging:</strong> All API access logged with IP, user agent, and geolocation</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
