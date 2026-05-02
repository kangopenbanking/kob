import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

interface Badge {
  label: string;
  to: string;
  description: string;
}

const BADGES: Badge[] = [
  { label: "FAPI 1.0 Advanced", to: "/developer/authentication/fapi", description: "OpenID Foundation security profile" },
  { label: "OAuth 2.0 / OIDC", to: "/developer/authentication/oauth2", description: "Standard token issuance + discovery" },
  { label: "RFC 7591 DCR", to: "/developer/authentication/dcr", description: "Dynamic Client Registration" },
  { label: "RFC 8705 mTLS", to: "/developer/authentication/mtls", description: "Certificate-bound access tokens" },
  { label: "RFC 7807 Errors", to: "/developer/api/error-codes", description: "Problem Details for HTTP APIs" },
  { label: "ISO 20022", to: "/developer/iso20022/messages", description: "pacs / pain / camt messaging" },
  { label: "OBIE Compatible", to: "/developer/api-reference/obie-migration", description: "UK Open Banking permission model" },
  { label: "Berlin Group", to: "/developer/open-banking/standards", description: "NextGenPSD2 XS2A mappable" },
  { label: "FDX 6.0", to: "/developer/open-banking/standards", description: "US Financial Data Exchange canonical model" },
  { label: "PSD2 SCA", to: "/developer/open-banking/consents", description: "Strong Customer Authentication" },
  { label: "COBAC / BEAC", to: "/developer/open-banking/standards", description: "CEMAC regional regulator alignment" },
];

export function StandardsComplianceRow() {
  return (
    <section
      id="standards-compliance"
      aria-label="Standards & Compliance"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Standards & Compliance</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
        Built on internationally recognised standards. Every badge links to its proof page — live
        implementation, code samples, and the published specification reference.
      </p>
      <ul className="flex flex-wrap gap-2">
        {BADGES.map((b) => (
          <li key={b.label}>
            <Link
              to={b.to}
              title={b.description}
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {b.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground mt-4">
        See the full{" "}
        <Link to="/developer/open-banking/standards" className="text-primary underline">
          Standards & Compliance Index
        </Link>
        .
      </p>
    </section>
  );
}
