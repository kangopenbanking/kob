import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const registerCert = `# Register your client certificate
curl -X POST https://api.kangopenbanking.com/v1/certificates \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "certificate_pem": "-----BEGIN CERTIFICATE-----\\nMIIE...\\n-----END CERTIFICATE-----",
    "usage": "transport",
    "description": "Production mTLS cert - expires 2027-03-01"
  }'

# Response
{
  "data": {
    "id": "cert_abc123",
    "thumbprint": "sha256:a1b2c3d4e5f6...",
    "valid_from": "2026-03-01T00:00:00Z",
    "valid_until": "2027-03-01T00:00:00Z",
    "status": "active"
  }
}`;

const useMtls = `# Make a request with mTLS
curl --cert client.pem --key client-key.pem \\
  -X GET https://api.kangopenbanking.com/v1/accounts \\
  -H "Authorization: Bearer eyJhbGciOiJQUzI1NiIs..."`;

const nodeMtls = `import https from 'https';
import fs from 'fs';

const agent = new https.Agent({
  cert: fs.readFileSync('./client.pem'),
  key: fs.readFileSync('./client-key.pem'),
  rejectUnauthorized: true,
});

const response = await fetch(
  'https://api.kangopenbanking.com/v1/accounts',
  {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    agent,
  }
);`;

export default function AuthMtls() {
  return (
    <>
      <Helmet>
        <title>mTLS Authentication | Kang Open Banking Developer Docs</title>
        <meta
          name="description"
          content="Mutual TLS (mTLS) authentication for institutional clients. Certificate registration, renewal, and certificate-bound token usage."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/authentication/mtls" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">mTLS Authentication</h1>
          <p className="text-lg text-muted-foreground">
            Mutual TLS (mTLS) provides the highest level of authentication security by binding access tokens to a
            specific client certificate. Required for regulated financial institutions under FAPI 1.0 Advanced.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="overview">
            How mTLS Works
          </h2>
          <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground mb-4 overflow-x-auto whitespace-pre">
            {`┌──────────┐                    ┌──────────────┐
│  Client  │  TLS handshake     │  Kang API    │
│  (Bank)  │  + client cert     │  Server      │
│          │───────────────────>│              │
│          │  Server verifies   │              │
│          │  cert thumbprint   │              │
│          │<───────────────────│              │
│          │  access_token      │              │
│          │  bound to cert     │              │
│          │  (cnf.x5t#S256)    │              │
└──────────┘                    └──────────────┘`}
          </div>
          <p className="text-muted-foreground">
            When using mTLS, the access token contains a{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">cnf</code> (confirmation) claim with the
            certificate thumbprint. The server validates that the certificate used for TLS matches the one bound to the
            token.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="register">
            Step 1: Register Certificate
          </h2>
          <CodeBlock examples={[{ code: registerCert, language: "bash" }]} title="Register Client Certificate" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="usage">
            Step 2: Make Requests
          </h2>
          <CodeBlock examples={[{ code: useMtls, language: "bash" }]} title="cURL with mTLS" />
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Node.js</h3>
          <CodeBlock examples={[{ code: nodeMtls, language: "javascript" }]} title="Node.js with mTLS" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="lifecycle">
            Certificate Lifecycle
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Action</th>
                  <th className="text-left p-3 font-medium text-foreground">Endpoint</th>
                  <th className="text-left p-3 font-medium text-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Register", "POST /v1/certificates", "Upload PEM-encoded X.509 certificate"],
                  ["List", "GET /v1/certificates", "View all registered certificates"],
                  ["Revoke", "DELETE /v1/certificates/{id}", "Immediately invalidates the certificate"],
                  ["Renew", "POST /v1/certificates", "Register new cert, then revoke old one"],
                ].map(([action, endpoint, notes]) => (
                  <tr key={action} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{action}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{endpoint}</td>
                    <td className="p-3 text-muted-foreground">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
