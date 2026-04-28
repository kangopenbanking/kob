import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { SecuredResponseSamples } from "@/components/developer/SecuredResponseSamples";

const parRequest = `curl -X POST https://api.kangopenbanking.com/v1/par-endpoint \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "client_id=your_client_id" \\
  -d "response_type=code" \\
  -d "scope=openid+accounts+balances+transactions" \\
  -d "redirect_uri=https://your-app.com/callback" \\
  -d "code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" \\
  -d "code_challenge_method=S256" \\
  -d "nonce=abc123def456"

# Response
{
  "request_uri": "urn:ietf:params:oauth:request_uri:abc123",
  "expires_in": 60
}`;

const tokenExchange = `curl -X POST https://api.kangopenbanking.com/v1/oauth-token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=auth_code_from_redirect" \\
  -d "redirect_uri=https://your-app.com/callback" \\
  -d "client_id=your_client_id" \\
  -d "code_verifier=your_original_code_verifier"

# Response
{
  "access_token": "eyJhbGciOiJQUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_abc123def456",
  "scope": "openid accounts balances transactions",
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}`;

const refreshToken = `curl -X POST https://api.kangopenbanking.com/v1/oauth-token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=rt_abc123def456" \\
  -d "client_id=your_client_id"`;

export default function AuthOAuth2() {
  return (
    <>
      <Helmet>
        <title>OAuth 2.0 Guide | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Complete OAuth 2.0 Authorization Code + PKCE guide for Kang Open Banking API. Step-by-step PAR, authorization, token exchange, and refresh flows." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/authentication/oauth2" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">OAuth 2.0 Authorization Code + PKCE</h1>
          <p className="text-lg text-muted-foreground">
            The Kang API uses OAuth 2.0 Authorization Code flow with PKCE for all Open Banking operations. This guide walks through each step with working examples.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="prerequisites">Prerequisites</h2>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li>A registered OAuth client (obtain via Dashboard or TPP registration)</li>
            <li>At least one registered redirect URI</li>
            <li>PKCE support in your application (required — plain code exchange is not supported)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="step-1">Step 1: Pushed Authorization Request (PAR)</h2>
          <p className="text-muted-foreground mb-4">
            All authorization requests must use PAR (RFC 9126). This pushes the authorization parameters to the server first, then uses the returned <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">request_uri</code> in the redirect.
          </p>
          <CodeBlock examples={[{ code: parRequest, language: "bash" }]} title="PAR Request" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="step-2">Step 2: Redirect User</h2>
          <p className="text-muted-foreground mb-4">
            Redirect the user to the authorization endpoint with the <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">request_uri</code>:
          </p>
          <CodeBlock examples={[{ code: `https://api.kangopenbanking.com/v1/oauth-authorize?request_uri=urn:ietf:params:oauth:request_uri:abc123&nonce=abc123def456`, language: "text" }]} title="Authorization Redirect URL" />
          <p className="text-sm text-muted-foreground mt-2">The user authenticates with their bank and approves the consent. They are redirected back to your <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">redirect_uri</code> with a <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">code</code> parameter.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="step-3">Step 3: Token Exchange</h2>
          <CodeBlock examples={[{ code: tokenExchange, language: "bash" }]} title="Exchange Code for Tokens" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Field</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["access_token", "JWT bearer token for API calls. Expires in 1 hour."],
                  ["refresh_token", "Use to obtain new access tokens without re-authorization."],
                  ["id_token", "OIDC identity token containing user claims."],
                  ["scope", "Granted scopes (may differ from requested if user restricted)."],
                ].map(([field, desc]) => (
                  <tr key={field} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{field}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="refresh">Step 4: Refresh Tokens</h2>
          <p className="text-muted-foreground mb-4">
            Access tokens expire after 1 hour. Use the refresh token to obtain new ones without user interaction. Requires <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">offline_access</code> scope.
          </p>
          <CodeBlock examples={[{ code: refreshToken, language: "bash" }]} title="Refresh Token" />
          <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg mt-4">
            <p className="text-sm text-foreground font-medium">Refresh Token Reuse Detection</p>
            <p className="text-sm text-muted-foreground">Each refresh token can only be used once. If reuse is detected, all tokens for that session are immediately revoked (per FAPI 1.0 security requirements).</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="errors">Common token errors</h2>
          <p className="text-muted-foreground mb-4">
            Both shapes below are returned as <code>application/problem+json</code> (RFC 7807). Implement handlers for both before going live.
          </p>
          <SecuredResponseSamples endpoint="POST /v1/oauth/token" scopeRequired="openid" />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
