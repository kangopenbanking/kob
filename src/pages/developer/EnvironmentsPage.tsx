// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P3, P6)
import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function EnvironmentsPage() {
  return (
    <GuidePageShell
      eyebrow="Operations"
      title="Environments — Sandbox vs. Production"
      description="Single source of truth for base URLs, OAuth endpoints, JWKS, status, and SLA across the Kang Open Banking sandbox and production environments."
      readTime="4 min read"
      level="Beginner"
      primaryCta={{ label: "Get sandbox keys", to: "/developer/sandbox/credentials" }}
      secondaryCta={{ label: "Status page", to: "/status" }}
      toc={[
        { id: "matrix", label: "Endpoint matrix" },
        { id: "switching", label: "Switching environments" },
        { id: "allow-list", label: "IP allow-list" },
        { id: "sla", label: "SLA & status" },
      ]}
    >
      <GuideCallout variant="success" title="Free sandbox forever — Order P3">
        The sandbox is fully featured and permanently free. Test credentials
        live at <a className="text-primary underline" href="/developer/sandbox/credentials">/developer/sandbox/credentials</a>.
      </GuideCallout>

      <GuideSectionBlock id="matrix" title="Endpoint matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Surface</th>
                <th className="text-left p-2">Sandbox</th>
                <th className="text-left p-2">Production</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="p-2">REST base URL</td><td className="p-2"><code>https://sandbox-api.kangopenbanking.com/v1</code></td><td className="p-2"><code>https://api.kangopenbanking.com/v1</code></td></tr>
              <tr className="border-b"><td className="p-2">OAuth token</td><td className="p-2"><code>/v1/oauth/token</code></td><td className="p-2"><code>/v1/oauth/token</code></td></tr>
              <tr className="border-b"><td className="p-2">OAuth authorize</td><td className="p-2"><code>/v1/oauth/authorize</code></td><td className="p-2"><code>/v1/oauth/authorize</code></td></tr>
              <tr className="border-b"><td className="p-2">PAR (Pushed Auth Req.)</td><td className="p-2"><code>/v1/oauth/par</code></td><td className="p-2"><code>/v1/oauth/par</code></td></tr>
              <tr className="border-b"><td className="p-2">JWKS</td><td className="p-2"><code>/v1/.well-known/jwks.json</code></td><td className="p-2"><code>/v1/.well-known/jwks.json</code></td></tr>
              <tr className="border-b"><td className="p-2">OIDC discovery</td><td className="p-2"><code>/v1/.well-known/openid-configuration</code></td><td className="p-2"><code>/v1/.well-known/openid-configuration</code></td></tr>
              <tr className="border-b"><td className="p-2">OpenAPI spec</td><td className="p-2"><a className="text-primary underline" href="/openapi-sandbox.json">/openapi-sandbox.json</a></td><td className="p-2"><a className="text-primary underline" href="/openapi.json">/openapi.json</a></td></tr>
              <tr className="border-b"><td className="p-2">Rate limits</td><td className="p-2">120 req/min/client</td><td className="p-2">300 req/min/client</td></tr>
              <tr className="border-b"><td className="p-2">Uptime SLA</td><td className="p-2">99.5% / mo (best-effort)</td><td className="p-2">99.9% / mo</td></tr>
              <tr><td className="p-2">mTLS</td><td className="p-2">Self-signed accepted</td><td className="p-2">eIDAS QWAC or competent CA</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="switching" title="Switching from sandbox to production">
        <CodeBlock
          examples={[
            {
              language: "bash",
              label: "Environment vars",
              code: `# .env.sandbox
KANG_BASE_URL=https://sandbox-api.kangopenbanking.com/v1
KANG_CLIENT_ID=sbx_xxxxxxxx
KANG_CLIENT_SECRET=sbx_secret_xxxxxxxx

# .env.production
KANG_BASE_URL=https://api.kangopenbanking.com/v1
KANG_CLIENT_ID=live_xxxxxxxx
KANG_CLIENT_SECRET=live_secret_xxxxxxxx`,
            },
            {
              language: "javascript",
              label: "Node.js SDK",
              code: `import { KangClient } from '@kangopenbanking/sdk';

const kang = new KangClient({
  baseUrl: process.env.KANG_BASE_URL,
  clientId: process.env.KANG_CLIENT_ID,
  clientSecret: process.env.KANG_CLIENT_SECRET,
});`,
            },
          ]}
        />
        <p className="text-sm text-muted-foreground mt-2">
          The OpenAPI spec, SDKs, and Postman collection accept either base URL —
          only credentials change. Run the
          <a className="text-primary underline" href="/developer/guides/go-live"> go-live checklist</a> before flipping production traffic.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="allow-list" title="IP allow-list (production)">
        <p>
          Production keys can be locked to specific egress IPs from the
          dashboard. Add every IP your servers may use (load balancers,
          serverless cold starts) before enforcing the allow-list — once
          enabled, requests from any other IP receive HTTP 403
          <code> ip_not_allowed</code>.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="sla" title="SLA & status">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Real-time status: <a className="text-primary underline" href="/status">/status</a></li>
          <li>Machine-readable health: <a className="text-primary underline" href="/support-agent-health.json">/support-agent-health.json</a></li>
          <li>SLA targets: <a className="text-primary underline" href="/developer/sla">/developer/sla</a></li>
          <li>Maintenance windows are announced 72 h in advance via the status page and registered developer email.</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
