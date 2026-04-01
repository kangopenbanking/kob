import { Helmet } from "react-helmet-async";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Link } from "react-router-dom";

export default function ComplianceFapi() {
  return (
    <>
      <Helmet>
        <title>FAPI Security Compliance | Kang Open Banking Developer Docs</title>
        <meta name="description" content="FAPI 1.0 Advanced security compliance guide for financial applications using the Kang Open Banking API." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/compliance/fapi" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">FAPI Security Compliance</h1>
          <p className="text-lg text-muted-foreground">
            A compliance checklist for financial applications integrating with the Kang Open Banking API under FAPI 1.0 Advanced, PSD2, and COBAC regulations.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="checklist">Security Checklist</h2>
          <div className="space-y-3">
            {[
              { category: "Authentication", items: [
                "PKCE (S256) used on all authorization requests",
                "PAR (Pushed Authorization Request) used — no query-string auth params",
                "Nonce included in all authorization requests",
                "Access tokens are short-lived (1 hour max)",
                "Refresh token rotation with reuse detection enabled",
              ]},
              { category: "Token Security", items: [
                "Tokens stored server-side only — never in localStorage/sessionStorage",
                "Certificate-bound tokens (mTLS) for confidential clients",
                "Token responses served with Cache-Control: no-store",
                "JWTs validated using Kang's JWKS endpoint",
              ]},
              { category: "Transport Security", items: [
                "TLS 1.2+ enforced on all connections",
                "Certificate pinning for mobile applications",
                "mTLS for institutional API access",
                "HSTS headers enabled on all endpoints",
              ]},
              { category: "Data Protection", items: [
                "API keys stored as environment variables, not in code",
                "Webhook signatures verified on every event",
                "PII encrypted at rest and in transit",
                "Audit logs retained for minimum 5 years (COBAC requirement)",
              ]},
            ].map((section) => (
              <div key={section.category} className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3">{section.category}</h3>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 w-4 h-4 border border-border rounded flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="standards">Standards Reference</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Standard</th>
                  <th className="text-left p-3 font-medium text-foreground">Scope</th>
                  <th className="text-left p-3 font-medium text-foreground">Kang Compliance</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["FAPI 1.0 Advanced", "API security for financial services", "Certified"],
                  ["PSD2 / SCA", "Strong Customer Authentication (EU)", "Compliant"],
                  ["OBIE R/W API v3.1", "UK Open Banking data model", "Adopted"],
                  ["COBAC / BEAC", "CEMAC banking regulations", "Compliant"],
                  ["ISO 20022", "Financial messaging standard", "9 message types supported"],
                  ["RFC 7807", "Problem Details for HTTP APIs", "All error responses"],
                ].map(([standard, scope, compliance]) => (
                  <tr key={standard} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{standard}</td>
                    <td className="p-3 text-muted-foreground">{scope}</td>
                    <td className="p-3 text-muted-foreground">{compliance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-sm text-muted-foreground">
          For detailed authentication implementation, see the <Link to="/developer/authentication/fapi" className="text-primary hover:underline">FAPI 1.0 Advanced guide</Link>.
        </p>

        <DocNavigation
          previousPage={{ title: "AML & SAR", path: "/developer/compliance/aml" }}
          nextPage={{ title: "ISO 20022", path: "/developer/iso20022" }}
        />
      </div>
    </>
  );
}
