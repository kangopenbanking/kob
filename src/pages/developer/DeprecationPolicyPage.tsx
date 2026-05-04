// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P6, P7)
import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function DeprecationPolicyPage() {
  return (
    <GuidePageShell
      eyebrow="API Reference"
      title="Deprecation Policy"
      description="How Kang Open Banking signals, communicates, and retires API surface — backed by RFC 8594 Sunset headers, a 12-month minimum window, and changelog entries within 48 hours."
      readTime="4 min read"
      level="Intermediate"
      primaryCta={{ label: "Versioning policy", to: "/developer/api-reference/versioning" }}
      secondaryCta={{ label: "Changelog", to: "/developer/changelog" }}
      toc={[
        { id: "principles", label: "Principles" },
        { id: "headers", label: "HTTP signals" },
        { id: "timeline", label: "Timeline" },
        { id: "channels", label: "Notification channels" },
        { id: "playbook", label: "Migration playbook" },
      ]}
    >
      <GuideCallout variant="info" title="Standing Order 1 — The Lock">
        No <code>operationId</code>, path key, schema name, security scheme, or
        component name is ever renamed or removed without a major version
        increment. Deprecation precedes removal by at least 12 months.
      </GuideCallout>

      <GuideSectionBlock id="principles" title="Principles">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><strong>Additive first</strong> — new fields, parameters, enum values, and endpoints land first; old surface remains until sunset.</li>
          <li><strong>Minimum 12 months</strong> between deprecation announcement and removal.</li>
          <li><strong>Always discoverable</strong> — every deprecated operation carries machine-readable HTTP signals AND a changelog entry within 48 h (Order P7).</li>
          <li><strong>Successor required</strong> — every deprecated endpoint must point to its replacement via the <code>Link</code> header.</li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="headers" title="HTTP signals (RFC 8594 + RFC 8288)">
        <CodeBlock
          examples={[
            {
              language: "http",
              label: "Response headers on a deprecated endpoint",
              code: `HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 31 Dec 2026 23:59:59 GMT
Link: <https://api.kangopenbanking.com/v1/webhooks/v2/endpoints>; rel="successor-version"
Warning: 299 - "This endpoint will be removed on 2026-12-31. Migrate to /v1/webhooks/v2/endpoints."`,
            },
          ]}
        />
        <p className="text-sm text-muted-foreground mt-2">
          The OpenAPI spec also marks the operation with
          <code> deprecated: true</code> and the
          <code> x-sunset</code>, <code>x-replacement</code> extensions —
          SDK generators emit deprecation warnings at compile time.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="timeline" title="Standard deprecation timeline">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">T+</th>
                <th className="text-left p-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="p-2">Day 0</td><td className="p-2">Successor endpoint ships, announcement in changelog, <code>Deprecation</code> + <code>Sunset</code> headers enabled.</td></tr>
              <tr className="border-b"><td className="p-2">Day 30</td><td className="p-2">First reminder email to all clients hitting the deprecated path.</td></tr>
              <tr className="border-b"><td className="p-2">Day 180</td><td className="p-2">Mid-cycle reminder + dashboard banner for affected accounts.</td></tr>
              <tr className="border-b"><td className="p-2">Day 330</td><td className="p-2">Final 30-day notice; <code>Warning</code> header escalates to severity 299.</td></tr>
              <tr><td className="p-2">Day 365+</td><td className="p-2">Endpoint returns HTTP 410 Gone with a Problem Details body pointing at the successor.</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="channels" title="Notification channels">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Public <a className="text-primary underline" href="/developer/changelog">/developer/changelog</a> entry within 48 hours.</li>
          <li><code>Deprecation</code> + <code>Sunset</code> response headers on every call.</li>
          <li>Email to the registered technical contact on every developer account.</li>
          <li>Banner in the developer dashboard for affected <code>client_id</code>s.</li>
          <li>Webhook event <code>api.endpoint.deprecated</code> for subscribed integrations.</li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="playbook" title="Migration playbook">
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Read the changelog entry and the successor’s reference page.</li>
          <li>Pin the new SDK version (see <a className="text-primary underline" href="/developer/guides/sdk-versioning">SDK versioning</a>).</li>
          <li>Run the <a className="text-primary underline" href="/developer/api-playground">API playground</a> against sandbox using the successor.</li>
          <li>Roll out behind a feature flag; monitor 4xx/5xx parity for 7 days.</li>
          <li>Remove the deprecated call and confirm the dashboard banner clears.</li>
        </ol>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
