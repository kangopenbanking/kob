// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { ShieldCheck, KeyRound, FileSignature, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";

const curlExample = `curl -X POST https://api.kangopenbanking.com/v1/dcr/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "software_statement": "eyJhbGciOiJQUzI1NiJ9.eyJzb2Z0d2FyZV9pZCI6InRwcF8wMDEi...",
    "redirect_uris": ["https://yourapp.com/callback"],
    "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "tls_client_auth",
    "scope": "openid accounts balances transactions payments offline_access"
  }'`;

const nodeExample = `import { randomUUID } from "node:crypto";

const res = await fetch("https://api.kangopenbanking.com/v1/dcr/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": randomUUID(),
  },
  body: JSON.stringify({
    software_statement: process.env.KANG_SSA_JWT,
    redirect_uris: ["https://yourapp.com/callback"],
    grant_types: ["authorization_code", "refresh_token", "client_credentials"],
    response_types: ["code"],
    token_endpoint_auth_method: "tls_client_auth",
    scope: "openid accounts balances transactions payments offline_access",
  }),
});

const { client_id, client_secret, registration_access_token } = await res.json();`;

const pythonExample = `import os, uuid, requests

res = requests.post(
    "https://api.kangopenbanking.com/v1/dcr/register",
    headers={
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={
        "software_statement": os.environ["KANG_SSA_JWT"],
        "redirect_uris": ["https://yourapp.com/callback"],
        "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "tls_client_auth",
        "scope": "openid accounts balances transactions payments offline_access",
    },
)
data = res.json()
client_id, client_secret = data["client_id"], data["client_secret"]`;

const responseExample = `{
  "client_id": "kob_client_3f9a2c1b8e",
  "client_secret": "kob_secret_4d7e9a1c2b5f8a3d6e9f1c4b7a2d5e8f",
  "client_id_issued_at": 1761350400,
  "client_secret_expires_at": 0,
  "registration_access_token": "rat_8f2a1c4b7e9d3a5b8c1e4f7a2d6e9b3c",
  "registration_client_uri": "https://api.kangopenbanking.com/v1/dcr/clients/kob_client_3f9a2c1b8e",
  "redirect_uris": ["https://yourapp.com/callback"],
  "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
  "token_endpoint_auth_method": "tls_client_auth",
  "scope": "openid accounts balances transactions payments offline_access"
}`;

export default function DynamicClientRegistration() {
  return (
    <>
      <Helmet>
        <title>Dynamic Client Registration (RFC 7591) | Kang Open Banking Developer Docs</title>
        <meta
          name="description"
          content="Register OAuth 2.0 / OIDC clients programmatically with Kang Open Banking using RFC 7591 Dynamic Client Registration. Signed Software Statement Assertion (SSA), FAPI 1.0 Advanced extensions, mTLS binding, rotation and revocation."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/authentication/dcr" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <header className="space-y-3">
          <Badge variant="outline" className="border-foreground/20">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> RFC 7591 · FAPI 1.0 Advanced
          </Badge>
          <h1 className="text-3xl font-bold text-foreground">Dynamic Client Registration (DCR)</h1>
          <p className="text-lg text-muted-foreground">
            Register a Third-Party Provider (TPP) application with Kang Open Banking programmatically using a
            signed Software Statement Assertion (SSA). Implements RFC 7591 with the FAPI 1.0 Advanced
            extensions required by UK Open Banking, Berlin Group NextGenPSD2, and FDX.
          </p>
        </header>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" /> Why DCR matters
            </CardTitle>
            <CardDescription>
              DCR removes per-bank manual onboarding. One signed SSA from the KOB Directory authorises a TPP
              against every connected bank in the network — the ecosystem layer that proprietary APIs lack.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>One registration call → reusable across every bank connector in the directory.</li>
              <li>Cryptographic trust anchored in the SSA JWT (signed by the KOB Directory key).</li>
              <li>Issued credentials are mTLS-bound (RFC 8705) for FAPI 1.0 Advanced flows.</li>
              <li>Lifecycle management: rotate, revoke, and read your registration via the registration access token.</li>
            </ul>
          </CardContent>
        </Card>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="endpoint">Endpoint</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Spec</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs">POST</TableCell>
                  <TableCell className="font-mono text-xs">/v1/dcr/register</TableCell>
                  <TableCell>Signed SSA (no bearer token required)</TableCell>
                  <TableCell>RFC 7591 § 3</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">GET</TableCell>
                  <TableCell className="font-mono text-xs">/v1/dcr/clients/{`{client_id}`}</TableCell>
                  <TableCell>Registration access token</TableCell>
                  <TableCell>RFC 7592 § 2</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">PUT</TableCell>
                  <TableCell className="font-mono text-xs">/v1/dcr/clients/{`{client_id}`}</TableCell>
                  <TableCell>Registration access token</TableCell>
                  <TableCell>RFC 7592 § 2.2</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs">DELETE</TableCell>
                  <TableCell className="font-mono text-xs">/v1/dcr/clients/{`{client_id}`}</TableCell>
                  <TableCell>Registration access token</TableCell>
                  <TableCell>RFC 7592 § 2.3</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="ssa">The Software Statement Assertion (SSA)</h2>
          <p className="text-muted-foreground mb-4">
            Before calling DCR you obtain a signed SSA JWT from the KOB Directory. The SSA contains the TPP's
            verified identity claims (software_id, software_client_name, software_roles) and is signed with the
            Directory's PS256 key. Required claims:
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["software_id", "string", "Stable identifier for the TPP application"],
                  ["software_client_name", "string", "Human-readable name shown to users on consent screens"],
                  ["software_roles", "string[]", "AISP, PISP, CBPII or any combination"],
                  ["software_jwks_uri", "uri", "URL of the TPP's public JWKS for request signing"],
                  ["org_id", "string", "Verified organisation identifier from the Directory"],
                ].map(([claim, type, desc]) => (
                  <TableRow key={claim}>
                    <TableCell className="font-mono text-xs">{claim}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="register">Register a client</h2>
          <CodeBlock
            examples={[
              { language: "bash", label: "cURL", code: curlExample },
              { language: "javascript", label: "Node.js", code: nodeExample },
              { language: "python", label: "Python", code: pythonExample },
            ]}
          />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="response">Response</h2>
          <p className="text-muted-foreground mb-4">
            The <code>client_secret</code> is returned in plaintext exactly once — store it in a secret manager
            immediately. The <code>registration_access_token</code> is required to read, update, or delete the
            registration later via RFC 7592.
          </p>
          <CodeBlock examples={[{ language: "json", label: "200 OK", code: responseExample }]} />
        </section>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Token endpoint auth methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Value</TableHead>
                    <TableHead>FAPI 1.0 Advanced</TableHead>
                    <TableHead>Use case</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["tls_client_auth", "Required", "Production clients with mTLS certificate"],
                    ["private_key_jwt", "Allowed", "Confidential clients without mTLS infra"],
                    ["client_secret_basic", "Sandbox only", "Test integrations during development"],
                  ].map(([v, fapi, use]) => (
                    <TableRow key={v}>
                      <TableCell className="font-mono text-xs">{v}</TableCell>
                      <TableCell>
                        <Badge variant={fapi === "Required" ? "default" : "secondary"}>{fapi}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{use}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-primary" /> Lifecycle: rotation & revocation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Rotate the secret:</strong> call <code>PUT /v1/dcr/clients/{`{client_id}`}</code>
              with your registration access token. The previous secret remains valid for a 24-hour grace window.
            </p>
            <p>
              <strong className="text-foreground">Revoke a client:</strong> call <code>DELETE /v1/dcr/clients/{`{client_id}`}</code>.
              All issued access tokens and refresh tokens are immediately invalidated.
            </p>
            <p>
              <strong className="text-foreground">Read your registration:</strong> call <code>GET /v1/dcr/clients/{`{client_id}`}</code>
              to verify the live metadata stored by the directory.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle>Standards alignment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>· <strong className="text-foreground">RFC 7591</strong> — Dynamic Client Registration Protocol</li>
              <li>· <strong className="text-foreground">RFC 7592</strong> — Dynamic Client Registration Management Protocol</li>
              <li>· <strong className="text-foreground">RFC 8705</strong> — mTLS Client Authentication & Certificate-Bound Tokens</li>
              <li>· <strong className="text-foreground">FAPI 1.0 Advanced § 5.2.2</strong> — token_endpoint_auth_method requirements</li>
              <li>· <strong className="text-foreground">UK Open Banking</strong> — SSA-based ecosystem trust model</li>
              <li>· <strong className="text-foreground">Berlin Group NextGenPSD2</strong> — eIDAS QWAC equivalent</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link to="/developer/authentication/fapi" className="text-primary underline">FAPI 1.0 Advanced →</Link>
              <Link to="/developer/authentication/mtls" className="text-primary underline">mTLS →</Link>
              <Link to="/developer/open-banking/standards" className="text-primary underline">Standards Index →</Link>
            </div>
          </CardContent>
        </Card>

        <AutoDocNavigation />
      </div>
    </>
  );
}
