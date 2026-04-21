import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { Link } from "react-router-dom";

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="space-y-3 scroll-mt-24">
    <h2 className="text-2xl font-semibold border-b pb-2">{title}</h2>
    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

const SecurityWhitepaper = () => (
  <div className="max-w-4xl mx-auto p-6 space-y-10">
    <SEO
      title="Security & Compliance Whitepaper | Kang Open Banking"
      description="Full security and compliance whitepaper: architecture, cryptography, token lifecycle, webhook integrity, regulatory mapping, deployment hardening, and incident response for the Kang Open Banking API."
    />

    <header className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Whitepaper</Badge>
        <Badge variant="outline">v4.16.4</Badge>
        <Badge variant="outline">FAPI 1.0 Advanced</Badge>
      </div>
      <h1 className="text-3xl font-bold">Kang Open Banking — Security &amp; Compliance Whitepaper</h1>
      <p className="text-muted-foreground">
        A complete reference for security architects, auditors, and integrators evaluating Kang Open Banking
        for production deployment.
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <a href="/whitepapers/security-compliance.pdf" target="_blank" rel="noopener noreferrer">
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/developer/security">Back to Live Verification</Link>
        </Button>
      </div>
    </header>

    <Section id="exec-summary" title="1. Executive Summary">
      <p>
        Kang Open Banking is a production-ready Open Banking platform serving the CEMAC region.
        It implements FAPI 1.0 Advanced (the strongest published OpenID Foundation profile for
        financial-grade APIs) end-to-end: PAR, JAR, PKCE-S256, and mTLS-bound tokens are required
        for all financial flows. AISP and PISP consent lifecycles follow the canonical Open Banking
        UK semantics.
      </p>
      <p>
        The API is at version <strong>4.16.4</strong>. The published Node SDK is at
        <code className="mx-1 rounded bg-muted px-1">@kangopenbanking/sdk</code> v1.2.0. All claims
        in this document are independently verifiable against the public
        <code className="mx-1 rounded bg-muted px-1">/healthz</code> and
        <code className="mx-1 rounded bg-muted px-1">/oidc-config</code> endpoints.
      </p>
    </Section>

    <Section id="architecture" title="2. Architecture Overview">
      <p>The request lifecycle for a regulated financial operation:</p>
      <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto">{`Client (TPP)
   │  mTLS (RFC 8705) — client certificate presented
   ▼
Reverse proxy (TLS 1.2+ termination, cert header forwarding)
   │
   ▼
PAR endpoint (RFC 9126) — pushed authorization request
   │  request_uri returned
   ▼
Authorize endpoint (OIDC + PKCE S256)
   │  authorization_code returned to redirect_uri
   ▼
Token endpoint (cert-bound access_token + refresh_token)
   │
   ▼
Resource server (AISP / PISP / Gateway / Banking)
   │
   ▼
Double-entry ledger + audit log + webhook dispatcher`}</pre>
    </Section>

    <Section id="authn-authz" title="3. Authentication &amp; Authorization">
      <p>
        Supported OAuth 2.0 grant types: <code>authorization_code</code>,
        <code className="mx-1">refresh_token</code>, <code>client_credentials</code>. The implicit
        and resource-owner-password grants are not supported — they are explicitly excluded by
        FAPI 1.0 Advanced. PKCE with S256 is mandatory for all public and confidential clients.
      </p>
      <p>
        Dynamic Client Registration (RFC 7591) is exposed at the
        <code className="mx-1 rounded bg-muted px-1">/dcr-register</code> endpoint with software-statement
        validation. Registered clients receive a <code>client_id</code> and a server-generated
        <code className="mx-1">client_secret</code> that is stored only as a SHA-256 hash.
      </p>
    </Section>

    <Section id="crypto" title="4. Cryptography">
      <ul className="list-disc pl-5 space-y-1">
        <li>Transport: TLS 1.2+ (TLS 1.3 preferred).</li>
        <li>JWS algorithms: RS256, PS256, ES256.</li>
        <li>Hashing: SHA-256 for token storage, webhook signatures, API keys, PINs.</li>
        <li>Symmetric encryption at rest: AES-256.</li>
        <li>Random sources: Web Crypto <code>crypto.getRandomValues()</code> / Deno equivalent.</li>
      </ul>
    </Section>

    <Section id="tokens" title="5. Token Lifecycle &amp; Rotation">
      <p>
        Access tokens are short-lived and certificate-bound when mTLS context is present.
        Refresh tokens rotate on every use; reuse is detected and revokes the entire token family
        per OAuth 2.1 best practices. The JWKS endpoint serves both current and previous keys
        during rotation overlap windows. Quarterly scheduled rotation is supplemented by manual
        rotation via the admin console.
      </p>
    </Section>

    <Section id="webhooks" title="6. Webhook Integrity Model">
      <p>
        Outbound webhooks are signed with HMAC-SHA256 over the canonical body and a timestamp.
        The signature is delivered in the <code>x-webhook-signature</code> header. Receivers
        should reject signatures whose timestamp is more than 5 minutes from current time.
        Delivery is retried up to 7 times with exponential backoff. Idempotency keys on receiving
        endpoints prevent duplicate side effects.
      </p>
    </Section>

    <Section id="audit" title="7. Audit Logging">
      <p>
        Three tables capture the full event trail: <code>audit_logs</code> (all identity events),
        <code className="mx-1">security_audit_logs</code> (risk-scored events with IP/UA), and
        <code>consent_events</code> (AISP/PISP consent lifecycle). All inserts are append-only
        and protected by RLS; the <code>has_role()</code> security-definer function gates admin
        reads.
      </p>
    </Section>

    <Section id="regulatory" title="8. Regulatory Mapping">
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>FAPI 1.0 Advanced:</strong> PAR + JAR + PKCE-S256 + mTLS — all enforced.</li>
        <li><strong>PSD2 SCA:</strong> Two-factor step-up enforced for sensitive operations.</li>
        <li><strong>COBAC / BEAC:</strong> Operational compliance for the CEMAC zone.</li>
        <li><strong>ISO 20022:</strong> pacs / camt / pain message families implemented.</li>
        <li><strong>PCI DSS Level 1:</strong> Card data handled only via tokenization.</li>
      </ul>
    </Section>

    <Section id="hardening" title="9. Deployment Hardening Checklist">
      <ul className="list-disc pl-5 space-y-1">
        <li>Terminate TLS at a reverse proxy that forwards client cert headers (<code>X-SSL-Client-Cert</code>).</li>
        <li>Enable strict transport security (HSTS) with a minimum 1-year max-age.</li>
        <li>Rotate JWKS signing keys at least quarterly; rotate API client secrets at least annually.</li>
        <li>Integrate TOTP secret encryption with a dedicated KMS (AWS KMS / GCP KMS / Vault).</li>
        <li>Ship audit logs to an immutable WORM store (S3 Object Lock or equivalent).</li>
        <li>Configure rate limits per environment (60 req/min sandbox, 300 req/min production baseline).</li>
        <li>Run the <code>/healthz</code> probe from your monitoring system at least every 60 seconds.</li>
      </ul>
    </Section>

    <Section id="incident" title="10. Incident Response &amp; SLA">
      <p>
        Incident severities, response times, and resolution targets are published on the
        <Link to="/developer/security" className="underline mx-1">Security &amp; Compliance</Link>
        page. The on-call rotation is engaged within 15 minutes for Critical incidents.
      </p>
    </Section>

    <Section id="versions" title="11. Version History">
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>4.16.4</strong> — Added <code>/healthz</code>, hardened <code>/oidc-config</code> caching, published this whitepaper.</li>
        <li><strong>4.16.3</strong> — Prior baseline.</li>
        <li><strong>4.15.0</strong> — CEMAC universal bank integration (Wave 4 documentation).</li>
      </ul>
    </Section>

    <footer className="border-t pt-4 text-xs text-muted-foreground">
      © Kang Open Banking. This whitepaper is published per Standing Order P1 (Public First) and
      P10 (Living Docs). Last updated alongside API v4.16.4.
    </footer>
  </div>
);

export default SecurityWhitepaper;
