import { GuidePageShell, GuideSectionBlock, GuideStep, GuideCallout } from "@/components/developer/GuidePageShell";

export default function PISP() {
  return (
    <GuidePageShell
      eyebrow="Open Banking"
      title="Payment Initiation Service Provider (PISP)"
      description="Initiate payments straight from a customer's bank account — no card required, with strong customer authentication."
      seoTitle="PISP Guide — Bank Payment Initiation API for Cameroon | Kang Open Banking"
      seoDescription="Initiate account-to-account payments with the Kang PISP API. SCA-compliant flows, instant settlement, no card fees — built for Cameroon and CEMAC."
      seoKeywords="PISP, payment initiation service, open banking payments, account-to-account, SCA, Cameroon payments API"
      canonicalPath="/guides/pisp"
      readTime="7 min read"
      level="Intermediate"
      primaryCta={{ label: "Open PISP reference", to: "/developer/api/pisp" }}
      toc={[
        { id: "what", label: "What is PISP?" },
        { id: "types", label: "Payment types" },
        { id: "flow", label: "End-to-end flow" },
        { id: "best", label: "Best practices" },
      ]}
    >
      <GuideSectionBlock id="what" title="What is PISP?">
        <p>
          A Payment Initiation Service Provider triggers a payment from the customer's bank account on
          their behalf. PISP is ideal for e-commerce checkout, bill pay and subscription top-ups where
          card fees are punitive.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="types" title="Payment types">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Single immediate</h3>
            <p className="text-sm text-muted-foreground">One-off payment cleared as fast as the bank rails allow.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">POST /v1/pisp/domestic-payment</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Scheduled</h3>
            <p className="text-sm text-muted-foreground">Future-dated single payment.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">POST /v1/pisp/scheduled-payment</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Standing order</h3>
            <p className="text-sm text-muted-foreground">Recurring fixed-amount payment.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">POST /v1/pisp/standing-order</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Bulk</h3>
            <p className="text-sm text-muted-foreground">Send up to 1 000 payouts in a single batch.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">POST /v1/pisp/bulk-payment</p>
          </div>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="flow" title="End-to-end flow">
        <GuideStep number={1} title="Create a payment consent">POST <code>/v1/payment-consents</code> with the payment details.</GuideStep>
        <GuideStep number={2} title="Redirect customer to authorise">Hand over to the bank-hosted authorisation URL for SCA.</GuideStep>
        <GuideStep number={3} title="Submit the payment">After authorisation, POST <code>/v1/pisp/domestic-payment</code> with the consent ID.</GuideStep>
        <GuideStep number={4} title="Track via webhooks">Listen for <code>payment.completed</code> or <code>payment.failed</code>.</GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="best" title="Best practices">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Always send an <code>Idempotency-Key</code>.</li>
          <li>Show the customer the destination, amount and reference before SCA.</li>
          <li>Don't fulfil the order until you receive <code>payment.completed</code>.</li>
        </ul>
        <GuideCallout variant="info" title="Refunds are out of scope.">
          PISP only initiates; for refunds use the original gateway charge or a separate payout.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
