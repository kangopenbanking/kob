import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function IdempotencyGuide() {
  return (
    <GuidePageShell
      eyebrow="Reference"
      title="Idempotency"
      description="Safely retry payment operations without ever creating duplicate charges, payouts or refunds."
      readTime="4 min read"
      level="Intermediate"
      toc={[
        { id: "how", label: "How it works" },
        { id: "example", label: "Example request" },
        { id: "endpoints", label: "Supported endpoints" },
        { id: "rules", label: "Key rules" },
      ]}
    >
      <GuideSectionBlock id="how" title="How it works">
        <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
          <li>Send a unique UUID in the <code>Idempotency-Key</code> header on every <code>POST</code>.</li>
          <li>If the key is new, we process the request and cache the response for 24 hours.</li>
          <li>If you retry with the same key and the same body, we return the cached response — no duplicate work.</li>
          <li>If you retry with the same key but a different body, we return <code>409 Conflict</code>.</li>
        </ol>
      </GuideSectionBlock>

      <GuideSectionBlock id="example" title="Example request">
        <CodeBlock
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237670000000"
  }'`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="endpoints" title="Supported endpoints">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><code>POST /v1/gateway/charges</code></li>
          <li><code>POST /v1/gateway/payouts</code></li>
          <li><code>POST /v1/gateway/refunds</code></li>
          <li><code>POST /v1/wallets/:id/credit</code></li>
          <li><code>POST /v1/wallets/:id/debit</code></li>
          <li><code>POST /v1/escrow</code></li>
          <li><code>POST /v1/payouts/instant</code></li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="rules" title="Key rules">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Keys must be UUIDv4.</li>
          <li>Keys expire after <strong>24 hours</strong>.</li>
          <li>Only <code>POST</code> endpoints support idempotency.</li>
          <li><code>GET</code>, <code>PUT</code> and <code>DELETE</code> are inherently idempotent.</li>
        </ul>
        <GuideCallout variant="warning" title="Generate one key per logical operation.">
          Reusing a key across two different intents is the #1 cause of unexpected 409s.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
