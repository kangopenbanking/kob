import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Download, ExternalLink } from "lucide-react";
import { LiveVerificationPanel } from "@/components/developer/security/LiveVerificationPanel";
import { StandardsMatrix } from "@/components/developer/security/StandardsMatrix";
import { SecurityFAQ } from "@/components/developer/security/SecurityFAQ";
import { Link } from "react-router-dom";

const Security = () => (
  <div className="max-w-5xl mx-auto space-y-8 p-6">
    <SEO
      title="Security & Compliance — Live Verification | Kang Open Banking"
      description="Live FAPI 1.0 Advanced, OIDC, mTLS, DCR, PAR, JAR, PKCE, and webhook security verification for the Kang Open Banking API. Verify all claims against /healthz and /oidc-config in one click."
    />

    <header>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> FAPI 1.0 Advanced</Badge>
        <Badge variant="outline">OIDC Core 1.0</Badge>
        <Badge variant="outline">RFC 7591 / 9126 / 9101 / 8705</Badge>
        <Badge variant="outline">v4.16.4</Badge>
      </div>
      <h1 className="text-3xl font-bold">Security &amp; Compliance — Live Verification</h1>
      <p className="text-muted-foreground mt-2 max-w-3xl">
        Every security capability advertised below is verifiable in real time against the live API.
        No login required. Reviewers, auditors, and prospective integrators can confirm OAuth, OIDC,
        mTLS, DCR, PAR, JAR, PKCE, and webhook posture in seconds.
      </p>
    </header>

    <LiveVerificationPanel />

    <StandardsMatrix />

    <Card>
      <CardHeader>
        <CardTitle>Token, Session &amp; Webhook Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <h3 className="font-medium mb-1">Token storage &amp; rotation</h3>
          <p className="text-muted-foreground">
            All access and refresh tokens are stored as SHA-256 hashes. Token responses set
            <code className="mx-1 rounded bg-muted px-1">Cache-Control: no-store</code> per RFC 6749 §5.1.
            Refresh-token rotation with reuse detection is enforced; suspected reuse revokes the entire family.
          </p>
        </div>
        <div>
          <h3 className="font-medium mb-1">Session governance</h3>
          <p className="text-muted-foreground">
            Single-active-session enforcement per app context, 5-minute inactivity timeout with 60-second
            warning, device fingerprinting, IP tracking, and instant displacement via Realtime channels.
          </p>
        </div>
        <div>
          <h3 className="font-medium mb-1">Step-up authentication</h3>
          <p className="text-muted-foreground">
            MFA (TOTP / SMS OTP / Email OTP) is required for sensitive operations: key rotation, payout
            configuration, role changes, and settlement updates. Challenges expire after 5 minutes; codes
            are stored hashed.
          </p>
        </div>
        <div>
          <h3 className="font-medium mb-1">Webhook integrity</h3>
          <p className="text-muted-foreground">
            All outbound webhooks are signed with HMAC-SHA256 and include a timestamp for replay protection.
            Idempotency keys prevent duplicate processing. Failed deliveries retry up to 7 times with
            exponential backoff.
          </p>
        </div>
      </CardContent>
    </Card>

    <Card id="jwks-rotation">
      <CardHeader>
        <CardTitle>JWKS &amp; Key Rotation Policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          The JWKS endpoint publishes the active signing keys. Rotation is performed manually via the
          admin signing-key console and automatically on a quarterly schedule. Both the previous and current
          keys are served during the overlap window so existing tokens remain verifiable until expiry.
        </p>
        <p>
          Supported algorithms: RS256, PS256, ES256. Clients should cache the JWKS response per its
          <code className="mx-1 rounded bg-muted px-1">Cache-Control</code> header and refresh on a
          <code className="mx-1 rounded bg-muted px-1">kid</code> miss.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/jwks-endpoint" target="_blank" rel="noopener noreferrer">
            View JWKS <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Sandbox</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          A free-forever sandbox environment is available for every integrator. Keys use the
          <code className="mx-1 rounded bg-muted px-1">sbx_</code> prefix. Per Standing Order P3 the
          sandbox will never be moved behind a paid plan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/developer/sandbox/console">Open Sandbox Console</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/developer/sandbox/credentials">View Test Credentials</Link>
          </Button>
        </div>
      </CardContent>
    </Card>

    <SecurityFAQ />

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Whitepaper</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Full security &amp; compliance whitepaper covering architecture, cryptography, token lifecycle,
          regulatory mapping, deployment hardening, and incident response.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/developer/security/whitepaper">Read HTML Whitepaper</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/whitepapers/security-compliance.pdf" target="_blank" rel="noopener noreferrer">
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Known Limitations — Honest Disclosure</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">mTLS in self-hosted deployments:</strong> Certificate-bound
          access tokens require the reverse proxy in front of the API to forward client certificate headers.
          The validation logic exists in the token layer; it activates when headers are present.
        </p>
        <p>
          <strong className="text-foreground">TOTP secret encryption:</strong> TOTP secrets are stored
          encrypted at rest. For high-regulation production deployments, integration with a dedicated KMS
          (AWS KMS / GCP KMS / HashiCorp Vault) is recommended.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default Security;
