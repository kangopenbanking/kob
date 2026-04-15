import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const curlExample = `# All API requests use Bearer token authentication
curl -H "Authorization: Bearer sk_test_your_key_here" \\
     -H "Content-Type: application/json" \\
     https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router`;

const pkceFlow = `// Step 1: Generate PKCE code verifier & challenge
import crypto from 'crypto';

const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Step 2: Build PAR request
const parResponse = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth/par',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'your_client_id',
      response_type: 'code',
      scope: 'openid accounts balances',
      redirect_uri: 'https://your-app.com/callback',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce: crypto.randomUUID(),
    }),
  }
);
const { request_uri } = await parResponse.json();

// Step 3: Redirect user to authorize
const authorizeUrl = \`https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth/authorize?request_uri=\${request_uri}\`;
// window.location.href = authorizeUrl;

// Step 4: Exchange code for tokens (in your callback handler)
const tokenResponse = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'auth_code_from_callback',
      redirect_uri: 'https://your-app.com/callback',
      client_id: 'your_client_id',
      code_verifier: codeVerifier,
    }),
  }
);
const { access_token, refresh_token } = await tokenResponse.json();`;

const pythonPkce = `import hashlib, base64, os, requests

# Step 1: Generate PKCE
code_verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
code_challenge = base64.urlsafe_b64encode(
    hashlib.sha256(code_verifier.encode()).digest()
).rstrip(b"=").decode()

# Step 2: PAR request
par = requests.post(
    "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth/par",
    data={
        "client_id": "your_client_id",
        "response_type": "code",
        "scope": "openid accounts balances",
        "redirect_uri": "https://your-app.com/callback",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "nonce": os.urandom(16).hex(),
    },
)
request_uri = par.json()["request_uri"]

# Step 3: Redirect user to authorize URL
# Step 4: Exchange code
token = requests.post(
    "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token",
    data={
        "grant_type": "authorization_code",
        "code": "auth_code_from_callback",
        "redirect_uri": "https://your-app.com/callback",
        "client_id": "your_client_id",
        "code_verifier": code_verifier,
    },
)
access_token = token.json()["access_token"]`;

export default function AuthenticationOverview() {
  return (
    <>
      <Helmet>
        <title>Authentication | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Authenticate with the Kang Open Banking API using API Keys, OAuth 2.0 with PKCE (FAPI 1.0 Advanced), or mTLS for institutional clients." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/authentication" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Authentication</h1>
          <p className="text-lg text-muted-foreground">
            The Kang Open Banking API supports two authentication modes: <strong>API Keys</strong> for gateway operations and <strong>OAuth 2.0 / FAPI 1.0 Advanced</strong> for Open Banking (AISP/PISP) flows.
          </p>
        </div>

        {/* API Key Authentication */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="api-keys">API Key Authentication</h2>
          <p className="text-muted-foreground mb-4">
            Use Bearer token authentication for all Gateway API calls (charges, payouts, subscriptions, etc.). You receive two keys when you register:
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Key Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Prefix</th>
                  <th className="text-left p-3 font-medium text-foreground">Use</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-3 text-foreground">Publishable Key</td>
                  <td className="p-3 font-mono text-sm text-muted-foreground">pk_test_ / pk_live_</td>
                  <td className="p-3 text-muted-foreground">Client-side (checkout forms, JS SDK). Cannot perform secret operations.</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 text-foreground">Secret Key</td>
                  <td className="p-3 font-mono text-sm text-muted-foreground">sk_test_ / sk_live_</td>
                  <td className="p-3 text-muted-foreground">Server-side only. Full API access. Never expose in frontend code.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-lg mb-4">
            <p className="text-sm text-foreground font-medium">Security Warning</p>
            <p className="text-sm text-muted-foreground">Never expose your secret key in client-side code, public repositories, or browser JavaScript. Use environment variables on your server.</p>
          </div>
          <CodeBlock examples={[{ code: curlExample, language: "bash" }]} title="Bearer Token Authentication" />
          <p className="text-sm text-muted-foreground mt-3">
            <Link to="/developer/authentication/api-keys" className="text-primary hover:underline">Full API Keys guide</Link> — rotation, restricted keys, and microservice scoping.
          </p>
        </section>

        {/* OAuth 2.0 / FAPI 1.0 */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="oauth2-fapi">OAuth 2.0 / FAPI 1.0 Advanced</h2>
          <p className="text-muted-foreground mb-4">
            Open Banking operations (AISP account reads, PISP payment initiation) require OAuth 2.0 Authorization Code flow with PKCE, conforming to <strong>FAPI 1.0 Advanced</strong>. This ensures the end-user explicitly authorises access to their bank data.
          </p>

          <h3 className="text-lg font-semibold text-foreground mb-3" id="oauth-flow">Authorization Flow</h3>
          <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground mb-4 overflow-x-auto whitespace-pre">
{`┌──────────┐     ┌──────────────┐     ┌────────────┐
│ Your App │     │ Kang OAuth   │     │ User Bank  │
└────┬─────┘     └──────┬───────┘     └─────┬──────┘
     │  1. PAR Request  │                   │
     │─────────────────>│                   │
     │  request_uri     │                   │
     │<─────────────────│                   │
     │  2. Redirect     │                   │
     │─────────────────>│  3. User login    │
     │                  │──────────────────>│
     │                  │  4. Consent       │
     │                  │<──────────────────│
     │  5. code         │                   │
     │<─────────────────│                   │
     │  6. Token exchange                   │
     │─────────────────>│                   │
     │  access_token    │                   │
     │<─────────────────│                   │
     │  7. API calls    │                   │
     │─────────────────>│                   │`}
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-3">Node.js Example</h3>
          <CodeBlock examples={[{ code: pkceFlow, language: "javascript" }]} title="OAuth 2.0 + PKCE Flow (Node.js)" />

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Python Example</h3>
          <CodeBlock examples={[{ code: pythonPkce, language: "python" }]} title="OAuth 2.0 + PKCE Flow (Python)" />
        </section>

        {/* Scopes */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="scopes">Scopes Reference</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Scope</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                  <th className="text-left p-3 font-medium text-foreground">Use Case</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["openid", "OIDC Connect identity", "All OAuth flows"],
                  ["accounts", "Read account data", "AISP"],
                  ["balances", "Read balances", "AISP"],
                  ["transactions", "Read transaction history", "AISP"],
                  ["payments", "Initiate payments", "PISP"],
                  ["offline_access", "Long-lived refresh tokens", "Background sync"],
                ].map(([scope, desc, useCase]) => (
                  <tr key={scope} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{scope}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                    <td className="p-3 text-muted-foreground">{useCase}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* mTLS */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="mtls">mTLS for Institutional Clients</h2>
          <p className="text-muted-foreground mb-4">
            Banks and regulated financial institutions can use mutual TLS (mTLS) for certificate-bound access tokens. This binds the token to a specific client certificate, preventing token theft.
          </p>
          <p className="text-sm text-muted-foreground">
            <Link to="/developer/authentication/mtls" className="text-primary hover:underline">Full mTLS setup guide</Link> — certificate registration, renewal, and revocation.
          </p>
        </section>

        {/* Next Steps */}
        {/* Which method do I need? */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="which-method">Which Authentication Method Do I Need?</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">You Are</th>
                  <th className="text-left p-3 font-medium text-foreground">Method</th>
                  <th className="text-left p-3 font-medium text-foreground">Scopes</th>
                  <th className="text-left p-3 font-medium text-foreground">Guide</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-3 text-foreground">Merchant (payments, payouts)</td>
                  <td className="p-3 text-muted-foreground">API Key (Bearer token)</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">N/A -- full gateway access</td>
                  <td className="p-3"><Link to="/developer/authentication/api-keys" className="text-primary hover:underline">API Keys Guide</Link></td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 text-foreground">TPP / Fintech (account data, payments)</td>
                  <td className="p-3 text-muted-foreground">OAuth 2.0 + PKCE (FAPI 1.0)</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">accounts, balances, payments</td>
                  <td className="p-3"><Link to="/developer/authentication/oauth2" className="text-primary hover:underline">OAuth 2.0 Guide</Link></td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 text-foreground">Bank / Financial Institution</td>
                  <td className="p-3 text-muted-foreground">mTLS (certificate-bound tokens)</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">All scopes + institutional</td>
                  <td className="p-3"><Link to="/developer/authentication/mtls" className="text-primary hover:underline">mTLS Guide</Link></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Deep Dive */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="next-steps">Deep Dive</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "API Keys Guide", desc: "Key rotation, restricted keys, microservice scoping", path: "/developer/authentication/api-keys" },
              { title: "OAuth 2.0 Guide", desc: "Full Authorization Code + PKCE walkthrough", path: "/developer/authentication/oauth2" },
              { title: "FAPI 1.0 Advanced", desc: "Security profile, PAR, and certification details", path: "/developer/authentication/fapi" },
              { title: "mTLS Guide", desc: "Certificate-bound tokens for institutional clients", path: "/developer/authentication/mtls" },
              { title: "Token Lifecycle", desc: "Token lifetimes, refresh rotation, and reuse detection", path: "/developer/guides/token-lifecycle" },
              { title: "Roles & Permissions", desc: "RBAC model, role hierarchy, and scope mapping", path: "/developer/guides/roles-permissions" },
            ].map((card) => (
              <Link key={card.path} to={card.path} className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <h3 className="font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
