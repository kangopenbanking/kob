import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Helmet } from "react-helmet-async";

export default function RoundupGuide() {
  return (
    <>
      <Helmet>
        <title>Round-Up Savings · Kang Open Banking</title>
        <meta
          name="description"
          content="Automated spare-change savings engine: configure thresholds, drive deposits from every transaction, and credit savings goals."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/roundup" />
      </Helmet>
      <GuidePageShell
        eyebrow="Smart Savings"
        title="Round-Up Savings"
        description="A production-grade spare-change engine that quietly turns everyday spending into automated savings."
        readTime="6 min read"
        level="Intermediate"
        toc={[
          { id: "formula", label: "Core formula" },
          { id: "settings", label: "Configure settings" },
          { id: "preview", label: "Preview a round-up" },
          { id: "process", label: "Process a transaction" },
          { id: "states", label: "Transaction states" },
          { id: "safety", label: "Safety rules" },
        ]}
      >
        <GuideSectionBlock id="formula" title="Core formula">
          <p className="text-muted-foreground">
            Every transaction is rounded up to the next multiple of the configured threshold. The
            difference is the round-up amount.
          </p>
          <CodeBlock
            examples={[
              {
                language: "javascript",
                label: "JavaScript",
                code: `// Transaction: 1,650 XAF · Threshold: 500
const rounded = Math.ceil(1650 / 500) * 500;   // 2000
const roundUp = rounded - 1650;                 // 350 XAF saved`,
              },
            ]}
          />
          <p className="text-muted-foreground">
            Allowed thresholds: <code>10</code>, <code>50</code>, <code>100</code>, <code>500</code>,
            <code> 1000</code>.
          </p>
        </GuideSectionBlock>

        <GuideSectionBlock id="settings" title="Configure settings">
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X PATCH https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/budgeting-ops/roundup/settings \\
  -H "Authorization: Bearer <user_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "enabled": true,
    "threshold": 500,
    "min_save": 50,
    "max_save": 2000,
    "daily_cap": 5000,
    "min_balance_floor": 5000,
    "default_goal_id": "goal_abc"
  }'`,
              },
            ]}
          />
        </GuideSectionBlock>

        <GuideSectionBlock id="preview" title="Preview a round-up">
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/budgeting-ops/roundup/preview \\
  -H "Authorization: Bearer <user_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1650}'

# {"original_amount":1650,"rounded_amount":2000,"roundup_amount":350,"threshold_used":500}`,
              },
              {
                language: "python",
                label: "Python",
                code: `import requests
r = requests.post(
    "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/budgeting-ops/roundup/preview",
    headers={"Authorization": f"Bearer {jwt}"},
    json={"amount": 1650},
)
print(r.json()["roundup_amount"])  # 350`,
              },
              {
                language: "javascript",
                label: "Node",
                code: `const res = await fetch(
  "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/budgeting-ops/roundup/preview",
  { method: "POST", headers: { Authorization: \`Bearer \${jwt}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 1650 }) }
);
console.log(await res.json());`,
              },
            ]}
          />
        </GuideSectionBlock>

        <GuideSectionBlock id="process" title="Process a transaction">
          <p className="text-muted-foreground">
            After a customer transaction confirms, post it to <code>/roundup/process</code>. The engine
            is idempotent on <code>source_tx_id</code> — safe to retry.
          </p>
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/budgeting-ops/roundup/process \\
  -H "Authorization: Bearer <user_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_tx_id": "tx_01HXYZ...",
    "amount": 1650,
    "wallet_balance": 18200,
    "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
  }'`,
              },
            ]}
          />
          <GuideCallout variant="info" title="One round-up per source transaction.">
            Retries with the same <code>source_tx_id</code> return the cached row with
            <code>replayed: true</code>.
          </GuideCallout>
        </GuideSectionBlock>

        <GuideSectionBlock id="states" title="Transaction states">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2">State</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr]:border-border/50">
              <tr><td className="py-2"><code>pending</code></td><td>Round-up calculated, awaiting confirmation</td></tr>
              <tr><td className="py-2"><code>processing</code></td><td>Debit in flight</td></tr>
              <tr><td className="py-2"><code>successful</code></td><td>Savings goal credited</td></tr>
              <tr><td className="py-2"><code>skipped</code></td><td>Rule blocked the save (low balance, cap, paused, below min)</td></tr>
              <tr><td className="py-2"><code>failed</code></td><td>Will retry +1h, +24h, then auto-pause</td></tr>
              <tr><td className="py-2"><code>reversed</code></td><td>Parent transaction was reversed</td></tr>
            </tbody>
          </table>
        </GuideSectionBlock>

        <GuideSectionBlock id="safety" title="Safety rules">
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li><strong>Minimum save</strong>: round-ups below this are dropped silently.</li>
            <li><strong>Maximum save</strong>: round-ups clamp to this ceiling.</li>
            <li><strong>Daily cap</strong>: prevents runaway saves on heavy-spend days.</li>
            <li><strong>Minimum balance floor</strong>: skip if the wallet would dip below this after saving.</li>
            <li><strong>Idempotency</strong>: enforced via <code>source_tx_id</code> + <code>idempotency_key</code> uniqueness.</li>
            <li><strong>Auto-pause</strong>: 3 consecutive failures pause auto-save for 24 hours.</li>
          </ul>
        </GuideSectionBlock>
      </GuidePageShell>
    </>
  );
}
