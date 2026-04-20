import { GuidePageShell, GuideSectionBlock, GuideStep, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function Security() {
  return (
    <GuidePageShell
      eyebrow="Security"
      title="API Security & Authentication"
      description="The protocols, encryption and key-management practices that protect your integration and your customers' data."
      readTime="8 min read"
      level="Intermediate"
      primaryCta={{ label: "Manage API keys", to: "/developer/api-keys" }}
      secondaryCta={{ label: "mTLS certificates", to: "/guides/certificates" }}
      toc={[
        { id: "oauth", label: "OAuth 2.0 + OIDC" },
        { id: "mtls", label: "Mutual TLS" },
        { id: "encryption", label: "Encryption" },
        { id: "checklist", label: "Hardening checklist" },
      ]}
    >
      <GuideSectionBlock id="oauth" title="OAuth 2.0 + OpenID Connect">
        <p>Kang implements OAuth 2.0 with OIDC. The Authorization Code flow is preferred for user-context APIs.</p>
        <CodeBlock
          examples={[
            {
              language: "http",
              label: "Token request",
              code: `POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=YOUR_REDIRECT_URI
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="mtls" title="Mutual TLS">
        <p>For FAPI 1.0 Advanced compliance, all production calls use mutual TLS with certificate-bound access tokens (RFC 8705).</p>
        <GuideCallout variant="info" title="Sandbox accepts self-signed certs.">
          Production requires a certificate from a recognised CA — see the <a href="/guides/certificates" className="text-primary underline">Certificates guide</a>.
        </GuideCallout>
      </GuideSectionBlock>

      <GuideSectionBlock id="encryption" title="Encryption">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>TLS 1.2+ in transit, with HSTS preloaded.</li>
          <li>AES-256 at rest, keys managed with KMS rotation every 90 days.</li>
          <li>JWT signing with RS256 / ES256 — never <code>none</code>.</li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="checklist" title="Hardening checklist">
        <GuideStep number={1} title="Store secrets in a secret manager">Never commit keys to git. Use AWS Secrets Manager, Vault, Doppler or similar.</GuideStep>
        <GuideStep number={2} title="Rotate keys quarterly">Use the <code>POST /v1/api-keys/rotate</code> endpoint to roll without downtime.</GuideStep>
        <GuideStep number={3} title="Allow-list source IPs">Lock production keys to your egress IPs from the dashboard.</GuideStep>
        <GuideStep number={4} title="Verify webhook signatures">Reject any webhook whose HMAC-SHA256 signature does not validate.</GuideStep>
        <GuideStep number={5} title="Enable MFA on the dashboard">All admins must use TOTP or hardware keys.</GuideStep>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
