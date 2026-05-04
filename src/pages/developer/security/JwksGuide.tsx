// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P4, P6)
import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function JwksGuide() {
  return (
    <GuidePageShell
      eyebrow="Security"
      title="JWKS — JSON Web Key Set"
      description="Public signing keys for verifying ID tokens, signed request objects, and webhook signatures. RFC 7517 compliant, advertised via OIDC discovery."
      readTime="5 min read"
      level="Intermediate"
      primaryCta={{ label: "Open JWKS endpoint", to: "https://api.kangopenbanking.com/v1/jwks" }}
      secondaryCta={{ label: "OIDC discovery", to: "https://api.kangopenbanking.com/v1/.well-known/openid-configuration" }}
      toc={[
        { id: "endpoints", label: "Endpoints" },
        { id: "fetch", label: "Fetching keys" },
        { id: "verify", label: "Verifying a token" },
        { id: "rotation", label: "Key rotation" },
      ]}
    >
      <GuideCallout variant="info" title="RFC 7517 + RFC 8414">
        Both <code>/v1/jwks</code> and the OIDC alias
        <code> /v1/.well-known/jwks.json</code> return the same
        JSON Web Key Set. The set is signed with RS256 and ES256 keys; clients
        MUST select the key whose <code>kid</code> matches the JWT header.
      </GuideCallout>

      <GuideSectionBlock id="endpoints" title="Endpoints">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Path</th>
                <th className="text-left p-2">Purpose</th>
                <th className="text-left p-2">Cache</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="p-2"><code>GET /v1/jwks</code></td><td className="p-2">Canonical JWKS document</td><td className="p-2"><code>max-age=3600</code></td></tr>
              <tr className="border-b"><td className="p-2"><code>GET /v1/.well-known/jwks.json</code></td><td className="p-2">OIDC alias (RFC 8414 §3)</td><td className="p-2"><code>max-age=3600</code></td></tr>
              <tr><td className="p-2"><code>GET /v1/.well-known/openid-configuration</code></td><td className="p-2">Discovery — exposes <code>jwks_uri</code></td><td className="p-2"><code>max-age=3600</code></td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="fetch" title="Fetching the key set">
        <CodeBlock
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl https://api.kangopenbanking.com/v1/.well-known/jwks.json`,
            },
            {
              language: "javascript",
              label: "Node.js",
              code: `import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://api.kangopenbanking.com/v1/.well-known/jwks.json')
);`,
            },
            {
              language: "python",
              label: "Python",
              code: `from jwt import PyJWKClient
jwks = PyJWKClient("https://api.kangopenbanking.com/v1/.well-known/jwks.json")`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="verify" title="Verifying a signed token">
        <CodeBlock
          examples={[
            {
              language: "javascript",
              label: "Node.js",
              code: `const { payload } = await jwtVerify(idToken, JWKS, {
  issuer: 'https://api.kangopenbanking.com/v1',
  audience: process.env.KANG_CLIENT_ID,
});
console.log(payload.sub, payload.scope);`,
            },
            {
              language: "python",
              label: "Python",
              code: `signing_key = jwks.get_signing_key_from_jwt(id_token)
payload = jwt.decode(
  id_token,
  signing_key.key,
  algorithms=["RS256"],
  audience=client_id,
  issuer="https://api.kangopenbanking.com/v1",
)`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="rotation" title="Key rotation policy">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Keys are rotated every <strong>90 days</strong>; the previous key remains in the JWKS for 30 days to validate in-flight tokens.</li>
          <li>New keys appear in the JWKS at least 24 hours before they sign tokens — re-fetch the JWKS on every <code>kid</code> miss.</li>
          <li>Emergency rotation events are announced via the changelog and the <code>key.rotated</code> webhook event.</li>
          <li>Cache the JWKS for at most 1 hour. Most JWT libraries (jose, PyJWT) handle this automatically.</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
