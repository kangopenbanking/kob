import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function RateLimitsGuide() {
  return (
    <GuidePageShell
      eyebrow="Reference"
      title="Rate Limits"
      description="Per-endpoint rate limits, response headers and the retry pattern we recommend."
      readTime="4 min read"
      level="Intermediate"
      toc={[
        { id: "limits", label: "Limits by endpoint" },
        { id: "headers", label: "Response headers" },
        { id: "retry", label: "Handling 429" },
        { id: "best", label: "Best practices" },
      ]}
    >
      <GuideSectionBlock id="limits" title="Limits by endpoint">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">Endpoint</th>
                <th className="text-left p-3">Sandbox</th>
                <th className="text-left p-3">Production</th>
                <th className="text-left p-3">Window</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t"><td className="p-3">Charges (POST)</td><td className="p-3">100</td><td className="p-3">1 000</td><td className="p-3">1 minute</td></tr>
              <tr className="border-t"><td className="p-3">Payouts (POST)</td><td className="p-3">50</td><td className="p-3">500</td><td className="p-3">1 minute</td></tr>
              <tr className="border-t"><td className="p-3">Wallets (CRUD)</td><td className="p-3">200</td><td className="p-3">2 000</td><td className="p-3">1 minute</td></tr>
              <tr className="border-t"><td className="p-3">Read (GET)</td><td className="p-3">500</td><td className="p-3">5 000</td><td className="p-3">1 minute</td></tr>
              <tr className="border-t"><td className="p-3">Webhooks v2 mgmt</td><td className="p-3">30</td><td className="p-3">100</td><td className="p-3">1 minute</td></tr>
              <tr className="border-t"><td className="p-3">Compliance screening</td><td className="p-3">50</td><td className="p-3">500</td><td className="p-3">1 minute</td></tr>
              <tr className="border-t"><td className="p-3">OIDC / Token</td><td className="p-3">60</td><td className="p-3">120</td><td className="p-3">1 minute</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="headers" title="Response headers">
        <CodeBlock
          examples={[
            {
              language: "http",
              label: "Headers",
              code: `X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1709290800
Retry-After: 12   # only on 429`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="retry" title="Handling 429 responses">
        <CodeBlock
          examples={[
            {
              language: "javascript",
              label: "Node.js",
              code: `async function apiCallWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fn();
    if (response.status !== 429) return response;
    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
  }
  throw new Error('Rate limit exceeded after retries');
}`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="best" title="Best practices">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Use exponential backoff with jitter.</li>
          <li>Cache <code>GET</code> responses where you can.</li>
          <li>Use webhooks instead of polling for status updates.</li>
          <li>Batch operations where the API supports it (e.g. bulk payouts).</li>
        </ul>
        <GuideCallout variant="info" title="Need higher limits?">
          Enterprise plans include lifted ceilings — contact <a href="/contact" className="text-primary underline">sales</a>.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
