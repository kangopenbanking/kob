import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function AuthFapi() {
  return (
    <>
      <Helmet>
        <title>FAPI 1.0 Advanced | Kang Open Banking Developer Docs</title>
        <meta name="description" content="FAPI 1.0 Advanced security profile implementation for Kang Open Banking API. PAR, PKCE, nonce, and certificate-bound tokens." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/authentication/fapi" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">FAPI 1.0 Advanced Security Profile</h1>
          <p className="text-lg text-muted-foreground">
            The Kang Open Banking API <strong>targets</strong> the Financial-grade API (FAPI) 1.0 Advanced profile. Formal OpenID Foundation certification is <strong>in progress</strong>. This page documents the security requirements your application must meet and the current conformance status — see the <a href="/developer/compliance/fapi" className="text-primary underline">conformance statement</a> for the control-by-control matrix.
          </p>
        </div>

        <div className="p-4 border border-amber-500/40 bg-amber-500/5 rounded-lg text-sm text-foreground">
          <p className="font-medium mb-1">Implementation maturity notice</p>
          <p className="text-muted-foreground">
            Several FAPI 1.0 Advanced controls are currently <em>partial</em> or on the roadmap, including mandatory PAR enforcement, signed Request Objects (JAR), JARM, <code className="font-mono">private_key_jwt</code> client authentication, and refresh-token rotation with reuse detection. Until certification completes, do not represent this gateway as a fully certified FAPI 1.0 Advanced deployment.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="requirements">Mandatory Requirements</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Requirement</th>
                  <th className="text-left p-3 font-medium text-foreground">Specification</th>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PKCE (S256)", "RFC 7636 — code_challenge required on all authorization requests", "Required — enforced"],
                  ["PAR", "RFC 9126 — Pushed Authorization Request endpoint available", "Available — not yet mandatory"],
                  ["Nonce", "OIDC Core — nonce parameter required in authorization request", "Required"],
                  ["JARM", "JWT Secured Authorization Response Mode", "Partial — roadmap"],
                  ["mTLS", "RFC 8705 — Certificate-bound access tokens (requires mTLS-terminating proxy)", "Available where infrastructure supports it"],
                  ["PS256 Signing", "JWTs signed with PS256 (RSASSA-PSS)", "Required"],
                  ["Token Binding", "Sender-constrained tokens via mTLS", "Available where infrastructure supports it"],
                ].map(([req, spec, status]) => (
                  <tr key={req} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{req}</td>
                    <td className="p-3 text-muted-foreground">{spec}</td>
                    <td className="p-3 text-muted-foreground">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="discovery">OIDC Discovery</h2>
          <p className="text-muted-foreground mb-4">
            The OpenID Connect discovery endpoint provides all configuration details:
          </p>
          <CodeBlock examples={[{ code: `curl https://api.kangopenbanking.com/v1/.well-known/openid-configuration

# Key fields:
{
  "issuer": "https://kangopenbanking.com",
  "authorization_endpoint": "https://api.kangopenbanking.com/v1/oauth/authorize",
  "token_endpoint": "https://api.kangopenbanking.com/v1/oauth/token",
  "pushed_authorization_request_endpoint": "https://api.kangopenbanking.com/v1/oauth/par",
  "jwks_uri": "https://api.kangopenbanking.com/v1/.well-known/jwks.json",
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["private_key_jwt", "tls_client_auth"],
  "id_token_signing_alg_values_supported": ["PS256"]
}`, language: "bash" }]} title="OIDC Discovery" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="client-types">Client Authentication Types</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Client Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Auth Method</th>
                  <th className="text-left p-3 font-medium text-foreground">Use Case</th>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Public (PKCE)", "No client secret — PKCE code_verifier proves possession", "Mobile apps, SPAs, public-facing TPPs", "Available"],
                  ["Confidential (client_secret)", "client_secret submitted at the token endpoint", "Server-to-server TPPs without mTLS infrastructure", "Available"],
                  ["Confidential (mTLS / tls_client_auth)", "TLS client certificate bound to access tokens. Requires an mTLS-terminating reverse proxy that forwards the client certificate as an HTTP header.", "Banks, regulated FIs with mTLS infrastructure", "Infrastructure-dependent"],
                  ["Confidential (private_key_jwt)", "JWT assertion signed with client private key", "Enterprise TPPs with HSM key storage", "Planned — not yet exercised at the token endpoint"],
                ].map(([type, method, useCase, status]) => (
                  <tr key={type} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{type}</td>
                    <td className="p-3 text-muted-foreground">{method}</td>
                    <td className="p-3 text-muted-foreground">{useCase}</td>
                    <td className="p-3 text-muted-foreground">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="compliance">Standards Alignment</h2>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li><strong>FAPI 1.0 Advanced</strong> — Targeted profile; conformance is partial and formal certification is in progress. See the <a href="/developer/compliance/fapi" className="text-primary underline">conformance statement</a>.</li>
            <li><strong>PSD2 SCA</strong> — Strong Customer Authentication patterns implemented via redirect and step-up flows; not a substitute for an EU PSD2 licence.</li>
            <li><strong>OBIE R/W API v3.1</strong> — Consent model is patterned on OBIE; no OBIE-issued conformance certificate.</li>
            <li><strong>COBAC</strong> — Designed to align with CEMAC regulatory expectations; operator licensing is in progress.</li>
          </ul>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
