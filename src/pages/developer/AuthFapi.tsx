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
            The Kang Open Banking API is certified to the Financial-grade API (FAPI) 1.0 Advanced profile. This page documents the security requirements your application must meet.
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
                  ["PKCE (S256)", "RFC 7636 — code_challenge required on all authorization requests", "Required"],
                  ["PAR", "RFC 9126 — All auth requests via Pushed Authorization Request endpoint", "Required"],
                  ["Nonce", "OIDC Core — nonce parameter required in authorization request", "Required"],
                  ["JARM", "JWT Secured Authorization Response Mode", "Supported"],
                  ["mTLS", "RFC 8705 — Certificate-bound access tokens for confidential clients", "Supported"],
                  ["PS256 Signing", "JWTs signed with PS256 (RSASSA-PSS)", "Required"],
                  ["Token Binding", "Sender-constrained tokens via mTLS or DPoP", "Supported"],
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
          <CodeBlock examples={[{ code: `curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/.well-known/openid-configuration

# Key fields:
{
  "issuer": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1",
  "authorization_endpoint": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-authorize",
  "token_endpoint": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token",
  "pushed_authorization_request_endpoint": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/par-endpoint",
  "backchannel_authentication_endpoint": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-bc-authorize",
  "jwks_uri": "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/.well-known/jwks.json",
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
                </tr>
              </thead>
              <tbody>
                {[
                  ["Public (PKCE)", "No client secret — PKCE code_verifier proves possession", "Mobile apps, SPAs, public-facing TPPs"],
                  ["Confidential (mTLS)", "TLS client certificate bound to access tokens", "Banks, regulated FIs, server-to-server"],
                  ["Confidential (private_key_jwt)", "JWT assertion signed with client private key", "Enterprise TPPs with HSM key storage"],
                ].map(([type, method, useCase]) => (
                  <tr key={type} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{type}</td>
                    <td className="p-3 text-muted-foreground">{method}</td>
                    <td className="p-3 text-muted-foreground">{useCase}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="compliance">Standards Compliance</h2>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li><strong>FAPI 1.0 Advanced</strong> — Full conformance (OpenID Foundation certified)</li>
            <li><strong>PSD2 SCA</strong> — Strong Customer Authentication via redirect flow</li>
            <li><strong>OBIE R/W API v3.1</strong> — UK Open Banking consent model</li>
            <li><strong>COBAC</strong> — Central African Banking Commission regulatory alignment</li>
          </ul>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
