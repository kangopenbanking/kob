// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Shield, CheckCircle, Globe, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Standard {
  name: string;
  status: "Compliant" | "Compatible" | "Aligned" | "Supported";
  authority: string;
  description: string;
  requirements: string[];
  proof?: { label: string; to: string };
}

const standards: Standard[] = [
  {
    name: "FAPI 1.0 Advanced",
    status: "Compliant",
    authority: "OpenID Foundation",
    description: "Financial-grade API security profile — high-assurance authentication and authorization for regulated banking APIs.",
    requirements: [
      "PKCE S256 mandatory on all authorization flows (RFC 7636)",
      "Pushed Authorization Requests required (RFC 9126)",
      "JWT-Secured Authorization Requests required (RFC 9101)",
      "PS256 signing for all client and server JWTs",
      "mTLS sender-constrained access tokens (RFC 8705)",
      "Nonce required in every authorization request",
    ],
    proof: { label: "View FAPI implementation", to: "/developer/authentication/fapi" },
  },
  {
    name: "OAuth 2.0 / OIDC Core",
    status: "Compliant",
    authority: "IETF / OpenID Foundation",
    description: "Authorization Code + PKCE, Client Credentials, and Refresh Token grant types with full OpenID Connect Discovery.",
    requirements: [
      "Authorization Code grant with PKCE for user-context APIs",
      "Client Credentials grant for server-to-server",
      "Refresh Token rotation — old token invalidated on every refresh",
      "OIDC Discovery at /.well-known/openid-configuration",
      "JWKS endpoint with PS256/RS256/ES256 keys",
      "ID Token + UserInfo endpoint for authenticated identity",
    ],
    proof: { label: "View OAuth 2.0 guide", to: "/developer/authentication/oauth2" },
  },
  {
    name: "RFC 7591 Dynamic Client Registration",
    status: "Compliant",
    authority: "IETF",
    description: "Programmatic client registration via signed Software Statement Assertion — the ecosystem layer for TPP onboarding.",
    requirements: [
      "POST /v1/dcr/register accepts SSA JWT signed by the KOB Directory",
      "RFC 7592 management endpoints (GET / PUT / DELETE)",
      "Registration access token issued for each client",
      "Token endpoint auth methods: tls_client_auth, private_key_jwt",
      "Client secret returned plaintext exactly once",
    ],
    proof: { label: "View DCR documentation", to: "/developer/authentication/dcr" },
  },
  {
    name: "RFC 8705 mTLS",
    status: "Compliant",
    authority: "IETF",
    description: "Mutual TLS Client Authentication and Certificate-Bound Access Tokens — required for FAPI 1.0 Advanced.",
    requirements: [
      "Client certificate validated against registered thumbprint",
      "Access tokens carry cnf.x5t#S256 confirmation claim",
      "Token usage rejected if presented with a different certificate",
      "Certificate upload + rotation via /v1/certificates endpoints",
    ],
    proof: { label: "View mTLS guide", to: "/developer/authentication/mtls" },
  },
  {
    name: "UK Open Banking (OBIE) Compatible",
    status: "Compatible",
    authority: "Open Banking Implementation Entity",
    description: "Read/Write API resources mirror the OBIE v3.x permission model — a 1:1 mapping is published for each endpoint.",
    requirements: [
      "Permissions enum: ReadAccountsDetail, ReadBalances, ReadTransactionsDetail, ReadBeneficiariesDetail",
      "Consent lifecycle: AwaitingAuthorisation → Authorised → Revoked / Expired",
      "Account, Balance, Transaction, Beneficiary, StandingOrder resources",
      "Domestic Payment Initiation aligned with OBIE write API",
      "Migration mapping documented endpoint-by-endpoint",
    ],
    proof: { label: "View OBIE migration guide", to: "/developer/api-reference/obie-migration" },
  },
  {
    name: "Berlin Group NextGenPSD2",
    status: "Compatible",
    authority: "Berlin Group",
    description: "XS2A interface model is mappable onto KOB consent + payment endpoints. SCA approach matches PSD2 RTS.",
    requirements: [
      "Consent endpoint mirrors XS2A /consents semantics",
      "Strong Customer Authentication via FAPI authorize flow",
      "TPP role declaration via SSA software_roles claim (AISP / PISP / CBPII)",
      "Embedded, Decoupled and Redirect SCA approaches supported",
      "Bulk and Periodic payments supported via the gateway",
    ],
    proof: { label: "View Open Banking overview", to: "/developer/open-banking" },
  },
  {
    name: "FDX 6.0 (US Financial Data Exchange)",
    status: "Compatible",
    authority: "Financial Data Exchange",
    description: "Canonical resource model maps onto FDX core resources — accounts, balances, transactions, contact info.",
    requirements: [
      "Accounts resource includes accountType, status, currency, nickname",
      "Balances resource separates available, current, limit",
      "Transactions resource carries postedTimestamp, transactionTimestamp, description, category",
      "Pagination via opaque cursor (FDX-compatible nextOffset semantics)",
      "Consent grant model compatible with FDX consent receipts",
    ],
  },
  {
    name: "PSD2 / Strong Customer Authentication",
    status: "Aligned",
    authority: "European Banking Authority",
    description: "SCA challenge flow follows PSD2 RTS Article 4 (two of: knowledge, possession, inherence).",
    requirements: [
      "AISP consent expires after 90 days unless re-authenticated",
      "PISP requires SCA on every payment initiation",
      "Dynamic linking: SCA bound to amount + payee (RTS Art. 5)",
      "Exemption support: low-value, trusted beneficiary, recurring payment",
      "TPP identification via eIDAS-equivalent certificate or SSA",
    ],
    proof: { label: "View consent management", to: "/developer/open-banking/consents" },
  },
  {
    name: "ISO 20022",
    status: "Supported",
    authority: "ISO / SWIFT",
    description: "Universal financial messaging standard for interbank payment and reporting messages.",
    requirements: [
      "pain.001 — Customer Credit Transfer Initiation",
      "pain.002 — Payment Status Report",
      "pacs.008 — FI to FI Customer Credit Transfer",
      "camt.052 — Intraday Account Report",
      "camt.053 — End-of-Day Statement",
      "camt.054 — Credit / Debit Notification",
    ],
    proof: { label: "View ISO 20022 messages", to: "/developer/iso20022/messages" },
  },
  {
    name: "RFC 7807 Problem Details",
    status: "Compliant",
    authority: "IETF",
    description: "All API errors returned as application/problem+json with stable type URIs and a machine-readable code catalog.",
    requirements: [
      "Content-Type: application/problem+json on every 4xx / 5xx",
      "Stable type URI per error code",
      "title, status, detail, instance fields populated",
      "63-code catalog published at /developer/api/error-codes",
    ],
    proof: { label: "View error code catalog", to: "/developer/api/error-codes" },
  },
  {
    name: "COBAC Regulatory Framework",
    status: "Compliant",
    authority: "Commission Bancaire de l'Afrique Centrale",
    description: "Banking Commission of Central Africa compliance for CEMAC member states.",
    requirements: [
      "Transaction reporting in COBAC-mandated format",
      "KYC/AML screening per COBAC Regulation R-2001/07",
      "Cross-border transaction monitoring for the CEMAC zone",
      "Suspicious activity report (SAR) generation",
    ],
  },
];

export default function OpenBankingStandards() {
  return (
    <>
      <Helmet>
        <title>Standards & Compliance Index | Kang Open Banking Developer Docs</title>
        <meta
          name="description"
          content="Kang Open Banking complies with FAPI 1.0 Advanced, OAuth 2.0 / OIDC, RFC 7591 DCR, RFC 8705 mTLS, RFC 7807 errors, ISO 20022, UK OBIE, Berlin Group NextGenPSD2, FDX 6.0, PSD2 SCA, and COBAC. Each standard links to its proof page."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/open-banking/standards" />
      </Helmet>

      <div className="space-y-8">
        <header className="space-y-3">
          <Badge variant="outline" className="border-foreground/20">
            <Shield className="h-3.5 w-3.5 mr-1.5" /> Standards & Compliance Index
          </Badge>
          <h1 className="text-3xl font-bold">Standards & Compliance</h1>
          <p className="text-muted-foreground max-w-3xl">
            Kang Open Banking is built on internationally recognised standards. Every entry below links to its
            proof page — the live implementation, code samples, and the published specification reference.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {standards.map((s) => (
            <Card key={s.name} className="border border-border/50">
              <CardContent className="pt-5 text-center">
                <Shield className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-2 text-sm font-semibold leading-tight">{s.name}</p>
                <Badge variant="default" className="mt-2 text-xs">{s.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {standards.map((s) => (
          <Card key={s.name} className="border border-border/50">
            <CardHeader>
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 text-primary mt-1" />
                <div className="flex-1">
                  <CardTitle>{s.name}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                  <p className="text-xs text-muted-foreground mt-1">Authority: {s.authority}</p>
                </div>
                <Badge variant="default" className="ml-auto">{s.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {s.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ul>
              {s.proof && (
                <div className="mt-4">
                  <Link
                    to={s.proof.to}
                    className="inline-flex items-center gap-1.5 text-sm text-primary underline"
                  >
                    {s.proof.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              CEMAC Zone Coverage
            </CardTitle>
            <CardDescription>
              Native COBAC / BEAC compliance across the six CEMAC member states.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Country</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Currency</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Regulator</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { country: "Cameroon", currency: "XAF", regulator: "COBAC / BEAC", status: "Active" },
                    { country: "Chad", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                    { country: "Central African Republic", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                    { country: "Republic of Congo", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                    { country: "Equatorial Guinea", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                    { country: "Gabon", currency: "XAF", regulator: "COBAC / BEAC", status: "Ready" },
                  ].map((c) => (
                    <tr key={c.country} className="border-b border-border/20">
                      <td className="px-3 py-2 font-medium">{c.country}</td>
                      <td className="px-3 py-2">{c.currency}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.regulator}</td>
                      <td className="px-3 py-2">
                        <Badge variant={c.status === "Active" ? "default" : "secondary"} className="text-xs">
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <AutoDocNavigation />
      </div>
    </>
  );
}
