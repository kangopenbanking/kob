// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P4)
import { Helmet } from "react-helmet-async";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Status = "supported" | "partial" | "not_supported";

interface Control {
  id: string;
  area: string;
  control: string;
  status: Status;
  spec: string;
  notes: string;
}

const CONTROLS: Control[] = [
  // Authorization request hardening
  { id: "FAPI-AUTH-1", area: "Authorization", control: "PKCE (S256) on every authorization request", status: "supported", spec: "FAPI-1.0-Adv §5.2.2-1", notes: "Enforced server-side. Plain method rejected." },
  { id: "FAPI-AUTH-2", area: "Authorization", control: "PAR (Pushed Authorization Requests, RFC 9126)", status: "supported", spec: "FAPI-1.0-Adv §5.2.2-2", notes: "/v1/oauth/par endpoint live; request_uri TTL 60s." },
  { id: "FAPI-AUTH-3", area: "Authorization", control: "Signed Request Object (JAR, RFC 9101)", status: "partial", spec: "FAPI-1.0-Adv §5.2.2-3", notes: "Accepted when client registers a JWKS; not yet mandatory. Mandatory enforcement targeted Q2 2026." },
  { id: "FAPI-AUTH-4", area: "Authorization", control: "Nonce required for all OIDC requests", status: "supported", spec: "OIDC Core §3.1.2.1", notes: "Missing nonce → invalid_request." },
  { id: "FAPI-AUTH-5", area: "Authorization", control: "redirect_uri exact match (no wildcard)", status: "supported", spec: "FAPI-1.0-Adv §5.2.2-7", notes: "Strict match against DCR-registered URIs." },
  { id: "FAPI-AUTH-6", area: "Authorization", control: "acr_values=urn:openbanking:psd2:sca enforced for high-value", status: "supported", spec: "PSD2 RTS Art. 4", notes: "Step-up SCA via /sca-challenge for amounts > XAF 250 000." },

  // Token endpoint
  { id: "FAPI-TOK-1", area: "Token", control: "Mutual TLS client authentication (tls_client_auth)", status: "supported", spec: "RFC 8705 §2.1", notes: "TLS termination at proxy; cert thumbprint verified in edge function (see mTLS limitations memo)." },
  { id: "FAPI-TOK-2", area: "Token", control: "private_key_jwt client authentication", status: "supported", spec: "OIDC Core §9", notes: "Alternative to mTLS for confidential clients." },
  { id: "FAPI-TOK-3", area: "Token", control: "Certificate-bound access tokens (cnf.x5t#S256)", status: "supported", spec: "RFC 8705 §3", notes: "Token cnf claim populated from mTLS thumbprint; resource server validates per request." },
  { id: "FAPI-TOK-4", area: "Token", control: "Refresh token rotation with reuse detection", status: "supported", spec: "OAuth 2.1 §6.1", notes: "Reuse triggers immediate revocation of token family." },
  { id: "FAPI-TOK-5", area: "Token", control: "Access token TTL ≤ 1 hour", status: "supported", spec: "FAPI-1.0-Adv §5.2.2-12", notes: "Default 900s; max 3600s." },
  { id: "FAPI-TOK-6", area: "Token", control: "Cache-Control: no-store on token responses", status: "supported", spec: "RFC 6749 §5.1", notes: "Header set globally on /v1/oauth/token." },

  // Authorization response / ID token
  { id: "FAPI-RSP-1", area: "Response", control: "JARM — JWT-secured Authorization Response Mode", status: "partial", spec: "FAPI-1.0-Adv §5.2.2-1c", notes: "response_mode=jwt accepted; response_mode=query.jwt and fragment.jwt planned." },
  { id: "FAPI-RSP-2", area: "Response", control: "ID token signed with PS256 / ES256 (no RS256 / HS256)", status: "supported", spec: "FAPI-1.0-Adv §8.6", notes: "PS256 default; ES256 available per client." },
  { id: "FAPI-RSP-3", area: "Response", control: "s_hash claim in ID token (state binding)", status: "partial", spec: "FAPI-1.0-Adv §5.2.2-1", notes: "Emitted when state present; not yet validated by all sample SDKs." },
  { id: "FAPI-RSP-4", area: "Response", control: "at_hash and c_hash claims", status: "supported", spec: "OIDC Core §3.1.3.6 / §3.3.2.11", notes: "Present in hybrid flows." },

  // Resource server
  { id: "FAPI-RES-1", area: "Resource Server", control: "x-fapi-interaction-id echoed on every response", status: "supported", spec: "FAPI-1.0-Adv §6.2.1-11", notes: "Generated when client omits; logged for trace correlation." },
  { id: "FAPI-RES-2", area: "Resource Server", control: "x-fapi-auth-date / x-fapi-customer-ip-address accepted", status: "supported", spec: "FAPI-1.0-Adv §6.2.1-12/13", notes: "Stored on consent for audit." },
  { id: "FAPI-RES-3", area: "Resource Server", control: "TLS 1.2 minimum (1.3 preferred); HSTS preload", status: "supported", spec: "FAPI-1.0-Adv §8.5", notes: "Enforced at edge; ciphers hardened to ECDHE-AES-GCM only." },
  { id: "FAPI-RES-4", area: "Resource Server", control: "Cnf claim validation per request (sender-constrained)", status: "supported", spec: "RFC 8705 §3", notes: "Mismatch → CERT_004." },

  // Consent / dynamic registration
  { id: "FAPI-CON-1", area: "Consent", control: "Granular permissions (Read/Write split per scope)", status: "supported", spec: "OBIE R/W §Permissions", notes: "AISP and PISP consents enforce per-permission scopes." },
  { id: "FAPI-CON-2", area: "Consent", control: "Consent revocation by PSU and TPP", status: "supported", spec: "PSD2 RTS Art. 67", notes: "Revoke endpoint emits consent.revoked webhook." },
  { id: "FAPI-CON-3", area: "DCR", control: "Dynamic Client Registration (RFC 7591) with signed SSA", status: "supported", spec: "RFC 7591 / OBIE", notes: "SSA JWT verified against operator JWKS." },

  // Logging / monitoring
  { id: "FAPI-LOG-1", area: "Audit", control: "5-year audit log retention (COBAC)", status: "supported", spec: "COBAC R-2016/04", notes: "Append-only audit_logs table; service-role only writes." },
  { id: "FAPI-LOG-2", area: "Audit", control: "Real-time fraud / anomaly monitoring on consents", status: "partial", spec: "FAPI-1.0-Adv §8.6.1", notes: "risk-score gate live; ML anomaly detection on consent grants is roadmap." },
];

const STATUS_META: Record<Status, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  supported: { label: "Supported", tone: "text-primary border-primary/40 bg-primary/5", Icon: CheckCircle2 },
  partial: { label: "Partial", tone: "text-amber-700 border-amber-500/40 bg-amber-500/5 dark:text-amber-400", Icon: AlertTriangle },
  not_supported: { label: "Not supported", tone: "text-destructive border-destructive/40 bg-destructive/5", Icon: XCircle },
};

export default function ComplianceFapi() {
  const counts = CONTROLS.reduce<Record<Status, number>>(
    (acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; },
    { supported: 0, partial: 0, not_supported: 0 },
  );
  const groups = Array.from(new Set(CONTROLS.map((c) => c.area)));

  return (
    <>
      <Helmet>
        <title>FAPI 1.0 Advanced Conformance Statement | Kang Open Banking</title>
        <meta
          name="description"
          content="Public conformance statement for the Kang Open Banking gateway against FAPI 1.0 Advanced. Lists every control with status — supported, partial, or not supported — and the spec section."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/compliance/fapi" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-10">
        <header className="space-y-3">
          <Badge variant="outline">Conformance Statement</Badge>
          <h1 className="text-3xl font-bold">FAPI 1.0 Advanced — Conformance Statement</h1>
          <p className="text-muted-foreground">
            This is the public, control-by-control conformance statement for the Kang Open Banking
            gateway against the OpenID Foundation's <em>Financial-grade API — Part 2: Advanced</em>
            (FAPI 1.0 Advanced) profile, plus the related PSD2 RTS, OBIE Read/Write API, and COBAC
            requirements that apply to CEMAC operators. It is updated within 7 days of any change
            (Standing Order P10).
          </p>
        </header>

        <section className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(STATUS_META) as Status[]).map((s) => {
            const m = STATUS_META[s];
            const Icon = m.Icon;
            return (
              <div key={s} className={`border rounded-lg p-4 ${m.tone}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4" /> {m.label}
                </div>
                <div className="text-2xl font-bold mt-1">{counts[s] ?? 0}</div>
                <div className="text-xs opacity-80">controls</div>
              </div>
            );
          })}
        </section>

        <section className="space-y-3 text-sm text-muted-foreground">
          <h2 className="text-xl font-bold text-foreground">How to read this page</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">Supported</strong> — control is enforced in production today and covered by automated contract tests.</li>
            <li><strong className="text-foreground">Partial</strong> — accepted but not yet mandatory, or limited to a subset of clients/flows. Notes describe the gap and the planned uplift.</li>
            <li><strong className="text-foreground">Not supported</strong> — explicitly out of scope; documented so integrators are not surprised.</li>
          </ul>
          <p>
            Where a control depends on infrastructure that terminates outside the application
            (TLS, mTLS), conformance is asserted at the verification layer inside an Edge Function
            — see <Link to="/developer/authentication/mtls" className="text-primary underline">mTLS notes</Link> for
            the trust chain.
          </p>
        </section>

        {groups.map((area) => (
          <section key={area}>
            <h2 className="text-xl font-bold mb-3">{area}</h2>
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Control</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Spec reference</th>
                    <th className="p-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTROLS.filter((c) => c.area === area).map((c) => {
                    const m = STATUS_META[c.status];
                    const Icon = m.Icon;
                    return (
                      <tr key={c.id} id={c.id} className="border-t border-border align-top scroll-mt-24">
                        <td className="p-3 font-mono text-xs whitespace-nowrap">
                          <a href={`#${c.id}`} className="text-primary hover:underline">{c.id}</a>
                        </td>
                        <td className="p-3 font-medium text-foreground">{c.control}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${m.tone}`}>
                            <Icon className="h-3 w-3" /> {m.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs whitespace-nowrap text-muted-foreground">{c.spec}</td>
                        <td className="p-3 text-muted-foreground">{c.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Out of scope (intentionally)</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Holder-of-Key tokens via DPoP (RFC 9449) — mTLS sender-constraint is the supported binding.</li>
            <li>SAML 2.0 federation at the OAuth layer — handled separately at the workspace SSO layer.</li>
            <li>Rich Authorization Requests (RAR, RFC 9396) — tracked but not yet implemented.</li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-muted-foreground">
          <h2 className="text-xl font-bold text-foreground">Verification</h2>
          <p>
            All <strong className="text-foreground">Supported</strong> controls are exercised by
            the API contract test suite and the OBIE conformance harness in CI. The latest run is
            published at <Link to="/developer/test-report" className="text-primary underline">/developer/test-report</Link>.
          </p>
          <p>
            For implementation details, see the <Link to="/developer/authentication/fapi" className="text-primary underline">FAPI implementation guide</Link>,
            <Link to="/developer/authentication/mtls" className="text-primary underline ml-1">mTLS guide</Link>, and
            <Link to="/developer/authentication/oauth2" className="text-primary underline ml-1">OAuth2 + PKCE quickstart</Link>.
          </p>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
