import { GuidePageShell, GuideStep, GuideCallout, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function FirstChargeGuide() {
  return (
    <GuidePageShell
      eyebrow="Getting Started"
      title="Send Your First Charge"
      description="Take a real (test) payment in under five minutes using sandbox credentials."
      readTime="5 min read"
      level="Beginner"
      primaryCta={{ label: "Get an API key first", to: "/developer/guides/first-api-key" }}
      secondaryCta={{ label: "Open API Explorer", to: "/developer/api-explorer" }}
      toc={[
        { id: "what", label: "What you'll build" },
        { id: "auth", label: "Authenticate" },
        { id: "create", label: "Create a charge" },
        { id: "confirm", label: "Confirm & test cards" },
        { id: "common", label: "Common questions" },
      ]}
    >
      <GuideSectionBlock id="what" title="What you'll build">
        <p>
          A charge collects money from a customer's card, mobile money wallet, or bank account. By the end
          of this guide you will have created and confirmed a single test charge for <strong>1 000 XAF</strong>.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="auth" title="Step 1 — Authenticate">
        <GuideStep number={1} title="Exchange your client credentials for an access token">
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=...&client_secret=...&scope=payments"`,
              },
            ]}
          />
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="create" title="Step 2 — Create a charge">
        <GuideStep number={2} title="POST /v1/gateway/charges">
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router" \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237670000000"
  }'`,
              },
            ]}
          />
          <GuideCallout variant="warning" title="Always send an Idempotency-Key">
            It guarantees that retrying after a network blip will not double-charge the customer.
          </GuideCallout>
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="confirm" title="Step 3 — Confirm & test cards">
        <p>The response includes a <code>status</code> field. Use these test details to trigger each outcome:</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left p-3">Outcome</th><th className="text-left p-3">Test value</th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t"><td className="p-3">Success</td><td className="p-3"><code>+237670000000</code></td></tr>
              <tr className="border-t"><td className="p-3">Insufficient funds</td><td className="p-3"><code>+237670000051</code></td></tr>
              <tr className="border-t"><td className="p-3">Customer cancels</td><td className="p-3"><code>+237670000002</code></td></tr>
              <tr className="border-t"><td className="p-3">Provider timeout</td><td className="p-3"><code>+237670000099</code></td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="common" title="Common questions">
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
          <li><strong>How do I know when the charge succeeds?</strong> Listen for the <code>charge.succeeded</code> webhook instead of polling.</li>
          <li><strong>Can I split the payment?</strong> Yes — see the <a href="/developer/gateway/split-payments" className="text-primary underline">Split Payments guide</a>.</li>
          <li><strong>What about refunds?</strong> POST to <code>/v1/gateway/refunds</code> with the original charge ID.</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
