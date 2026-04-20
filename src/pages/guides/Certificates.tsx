import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { Badge } from "@/components/ui/badge";

export default function Certificates() {
  return (
    <GuidePageShell
      eyebrow="Security"
      title="mTLS Certificates"
      description="Mutual TLS authentication and FAPI 1.0 Advanced certificate-bound access tokens, explained."
      readTime="6 min read"
      level="Advanced"
      primaryCta={{ label: "Manage certificates", to: "/developer/certificates" }}
      toc={[
        { id: "what", label: "What is mTLS?" },
        { id: "benefits", label: "Why we use it" },
        { id: "requirements", label: "Requirements" },
      ]}
    >
      <GuideCallout variant="success" title="FAPI 1.0 Advanced Certified">
        Kang Open Banking implements certificate-bound access tokens per RFC 8705.
      </GuideCallout>

      <GuideSectionBlock id="what" title="What is mutual TLS?">
        <p>
          Standard TLS authenticates the server to the client. Mutual TLS adds the reverse — the client
          must present an X.509 certificate so the server knows exactly who is calling.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="benefits" title="Why we use it">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>Strong authentication</strong> — cryptographic proof of client identity.</li>
          <li><strong>Token binding</strong> — access tokens are bound to your certificate (RFC 8705).</li>
          <li><strong>Theft resistance</strong> — a stolen token is useless without the matching private key.</li>
          <li><strong>Regulatory compliance</strong> — required by PSD2, UK Open Banking and similar regimes.</li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="requirements" title="Certificate requirements">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <Badge variant="secondary" className="mb-2">Sandbox</Badge>
            <h3 className="font-semibold mb-2">Self-signed accepted</h3>
            <p className="text-sm text-muted-foreground">
              Generate a key + certificate locally with OpenSSL — perfect for development and CI tests.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Badge className="mb-2">Production</Badge>
            <h3 className="font-semibold mb-2">Regulatory CA required</h3>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>eIDAS QWAC certificates (EU)</li>
              <li>Certificates from a competent authority in your jurisdiction</li>
              <li>Validity 1–2 years</li>
            </ul>
          </div>
        </div>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
