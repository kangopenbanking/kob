import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const TokenLifecycleGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Token Lifecycle | Kang Open Banking" description="Access token lifetimes, refresh token rotation policy, and session security for the Kang Open Banking API." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Token Lifecycle &amp; Rotation</h1>
      <p className="text-muted-foreground mt-2">
        The Kang API uses short-lived access tokens with rotating refresh tokens to balance security and developer experience.
        This page documents token lifetimes, rotation behavior, and reuse detection.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Token Type</th>
            <th className="text-left py-2 font-semibold">Lifetime</th>
            <th className="text-left py-2 font-semibold">Rotation</th>
            <th className="text-left py-2 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">access_token</td>
            <td>15 minutes</td>
            <td>Non-rotating</td>
            <td>Request a new one via refresh grant</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">refresh_token</td>
            <td>30 days</td>
            <td>Rotating</td>
            <td>Each use issues a new token and invalidates the previous one</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">authorization_code</td>
            <td>60 seconds</td>
            <td>Single-use</td>
            <td>Must be exchanged for tokens immediately</td>
          </tr>
          <tr>
            <td className="py-2 font-mono text-xs">PAR request_uri</td>
            <td>90 seconds</td>
            <td>Single-use</td>
            <td>Pushed Authorization Request reference</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Refresh Token Rotation</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Every time you exchange a refresh token for a new access token, the API returns a new refresh token
        and immediately invalidates the old one. This follows the OAuth 2.1 rotating refresh token model.
      </p>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`POST /v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=rt_old_abc123
&client_id=your_client_id

Response:
{
  "access_token": "at_new_xyz789",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "rt_new_def456",   // New token — old one is now invalid
  "scope": "accounts:read payments:write"
}`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Reuse Detection</h3>
      <p className="text-sm text-muted-foreground mb-3">
        If a previously used refresh token is presented again (e.g., due to a replay attack or race condition),
        the API immediately revokes the entire token chain for that session:
      </p>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>The reused refresh token is rejected with <code className="bg-muted px-1 rounded">401 invalid_grant</code></li>
        <li>All descendant access tokens and refresh tokens in the chain are revoked</li>
        <li>The user must re-authenticate from scratch</li>
        <li>A <code className="bg-muted px-1 rounded">token.reuse_detected</code> webhook event is fired</li>
      </ul>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Best Practices</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Store refresh tokens securely (encrypted at rest, never in client-side storage)</li>
        <li>Refresh access tokens proactively at ~80% of lifetime (12 minutes)</li>
        <li>Never use the same refresh token concurrently across multiple threads</li>
        <li>Implement a token refresh mutex to prevent race conditions</li>
        <li>Handle <code className="bg-muted px-1 rounded">401</code> responses by re-authenticating, not by retrying the same refresh token</li>
      </ul>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Token Refresh Example</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`// Node.js — Safe token refresh with mutex
let refreshMutex = null;

async function getValidToken() {
  if (tokenExpiresIn() > 120) return currentAccessToken;
  
  if (!refreshMutex) {
    refreshMutex = refreshAccessToken();
  }
  
  try {
    const tokens = await refreshMutex;
    currentAccessToken = tokens.access_token;
    currentRefreshToken = tokens.refresh_token; // Store the NEW refresh token
    return currentAccessToken;
  } finally {
    refreshMutex = null;
  }
}`}
      </pre>
    </div>

    <AutoDocNavigation />
  </div>
);

export default TokenLifecycleGuide;
