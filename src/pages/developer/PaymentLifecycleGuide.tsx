// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// /developer/api-reference/payment-lifecycle
//
// Closes the "no flow documentation" gap reported by AI crawlers and SEO
// audits. Combines Mermaid sequence diagrams (end-to-end interactions) with
// state-machine diagrams for every long-lived resource: charges, payouts,
// disputes, and refunds.
//
// Standing Order P6 (Complete Content): every section has explanation +
// diagram + state table — no link-only blocks.

import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const chargeSequence = `
sequenceDiagram
    autonumber
    participant Client as Merchant client
    participant KOB as Kang API
    participant PSP as Provider (MoMo/Card)
    participant WH as Webhook receiver
    Client->>KOB: POST /v1/charges (Idempotency-Key)
    KOB-->>Client: 201 charge.pending
    KOB->>PSP: Forward authorization request
    PSP-->>KOB: Async result (success/failed)
    KOB->>WH: charge.succeeded (signed, attempt 1)
    WH-->>KOB: 2xx ack
    Note over KOB,WH: If non-2xx, retry up to 7 times<br/>with exponential backoff
    Client->>KOB: GET /v1/charges/{id}
    KOB-->>Client: 200 charge.succeeded
`;

const chargeState = `
stateDiagram-v2
    [*] --> pending
    pending --> processing: provider accepted
    pending --> failed: validation error
    processing --> succeeded: provider settled
    processing --> failed: provider declined
    succeeded --> refunded: POST /refunds
    succeeded --> disputed: chargeback received
    refunded --> [*]
    disputed --> resolved
    failed --> [*]
    resolved --> [*]
`;

const payoutSequence = `
sequenceDiagram
    autonumber
    participant Client as Merchant client
    participant KOB as Kang API
    participant Rail as Payout rail
    participant WH as Webhook receiver
    Client->>KOB: POST /v1/payouts (Idempotency-Key)
    KOB-->>Client: 201 payout.queued
    KOB->>Rail: Submit instruction
    Rail-->>KOB: Accepted / Rejected
    KOB->>WH: payout.processing
    Rail-->>KOB: Final status
    KOB->>WH: payout.paid OR payout.failed
    WH-->>KOB: 2xx ack
`;

const payoutState = `
stateDiagram-v2
    [*] --> queued
    queued --> processing: rail accepted
    queued --> failed: validation error
    processing --> paid: rail settled
    processing --> failed: rail declined
    processing --> returned: beneficiary rejected
    paid --> [*]
    failed --> [*]
    returned --> [*]
`;

const disputeState = `
stateDiagram-v2
    [*] --> needs_response: chargeback opened
    needs_response --> under_review: evidence submitted
    needs_response --> lost: SLA expired
    under_review --> won: issuer accepted evidence
    under_review --> lost: issuer rejected evidence
    won --> [*]
    lost --> [*]
`;

const refundState = `
stateDiagram-v2
    [*] --> pending
    pending --> succeeded: provider settled
    pending --> failed: provider declined
    succeeded --> [*]
    failed --> [*]
`;

const StateTable = ({
  rows,
}: {
  rows: { state: string; meaning: string; terminal: boolean }[];
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left py-2 font-semibold">State</th>
          <th className="text-left py-2 font-semibold">Meaning</th>
          <th className="text-left py-2 font-semibold">Terminal</th>
        </tr>
      </thead>
      <tbody className="text-muted-foreground">
        {rows.map((r) => (
          <tr key={r.state} className="border-b last:border-0">
            <td className="py-2 font-mono text-xs">{r.state}</td>
            <td className="py-2 pr-4">{r.meaning}</td>
            <td className="py-2">{r.terminal ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const PaymentLifecycleGuide = () => (
  <div className="max-w-5xl mx-auto space-y-10 p-6">
    <SEO
      title="Payment Lifecycle, State Machines & Webhooks | Kang Open Banking"
      description="Sequence diagrams and state machines for charges, payouts, refunds, and disputes. End-to-end flows showing pending, processing, succeeded, failed, refunded, disputed, and resolved transitions."
    />

    <header>
      <Badge variant="outline" className="mb-2">
        Reference
      </Badge>
      <h1 className="text-3xl font-bold">Payment lifecycle & state machines</h1>
      <p className="text-muted-foreground mt-3 max-w-3xl">
        Every long-lived resource in the Kang Open Banking API moves through a
        documented state machine. This page shows the end-to-end sequence and
        the canonical states for charges, payouts, refunds, and disputes so you
        can build correct retry, reconciliation, and webhook handling logic.
      </p>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>1. Charge lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A charge is a request to move money from a customer to a merchant.
          The end-to-end flow always involves the merchant client, the Kang
          API, the upstream provider (mobile money operator, card network, or
          bank), and your webhook receiver.
        </p>
        <MermaidDiagram chart={chargeSequence} />

        <h3 className="text-base font-semibold pt-2">State machine</h3>
        <MermaidDiagram chart={chargeState} />

        <StateTable
          rows={[
            { state: "pending", meaning: "Created. Awaiting provider acceptance.", terminal: false },
            { state: "processing", meaning: "Provider accepted; awaiting final settlement.", terminal: false },
            { state: "succeeded", meaning: "Funds captured. Webhook charge.succeeded fired.", terminal: false },
            { state: "failed", meaning: "Validation error or provider declined.", terminal: true },
            { state: "refunded", meaning: "Full or partial refund issued.", terminal: true },
            { state: "disputed", meaning: "Chargeback opened against this charge.", terminal: false },
            { state: "resolved", meaning: "Dispute closed (won or lost).", terminal: true },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>2. Payout lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A payout pushes funds from a merchant balance to a beneficiary
          account. Payouts can be returned by the receiving rail (e.g. closed
          account), so the state machine includes a non-terminal{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">returned</code>{" "}
          state in addition to <code className="font-mono text-xs bg-muted px-1 rounded">paid</code>{" "}
          and <code className="font-mono text-xs bg-muted px-1 rounded">failed</code>.
        </p>
        <MermaidDiagram chart={payoutSequence} />

        <h3 className="text-base font-semibold pt-2">State machine</h3>
        <MermaidDiagram chart={payoutState} />

        <StateTable
          rows={[
            { state: "queued", meaning: "Created. Awaiting rail submission.", terminal: false },
            { state: "processing", meaning: "Rail accepted; awaiting settlement.", terminal: false },
            { state: "paid", meaning: "Beneficiary credited.", terminal: true },
            { state: "failed", meaning: "Rail rejected or validation failed.", terminal: true },
            { state: "returned", meaning: "Funds bounced back from beneficiary bank.", terminal: true },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>3. Refund lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Refunds inherit the originating charge&apos;s provider. Most providers
          settle synchronously, but some (notably bank rails) can take up to 5
          business days, hence the explicit{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">pending</code>{" "}
          state.
        </p>
        <MermaidDiagram chart={refundState} />

        <StateTable
          rows={[
            { state: "pending", meaning: "Submitted to provider; awaiting confirmation.", terminal: false },
            { state: "succeeded", meaning: "Funds returned to customer.", terminal: true },
            { state: "failed", meaning: "Provider rejected the refund.", terminal: true },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>4. Dispute lifecycle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When an issuer raises a chargeback, the related charge enters the{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">disputed</code>{" "}
          state and a new dispute resource is opened. You have a per-network
          SLA window to submit evidence; missing the SLA results in an
          automatic loss.
        </p>
        <MermaidDiagram chart={disputeState} />

        <StateTable
          rows={[
            { state: "needs_response", meaning: "Chargeback opened. Submit evidence before SLA.", terminal: false },
            { state: "under_review", meaning: "Evidence submitted; awaiting issuer decision.", terminal: false },
            { state: "won", meaning: "Issuer accepted evidence; funds returned to merchant.", terminal: true },
            { state: "lost", meaning: "Issuer rejected evidence or SLA expired.", terminal: true },
          ]}
        />
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Webhook events you should handle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Event</th>
                <th className="text-left py-2 font-semibold">Resource</th>
                <th className="text-left py-2 font-semibold">Trigger</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2 font-mono text-xs">charge.succeeded</td><td>charge</td><td>Funds captured</td></tr>
              <tr className="border-b"><td className="py-2 font-mono text-xs">charge.failed</td><td>charge</td><td>Provider declined</td></tr>
              <tr className="border-b"><td className="py-2 font-mono text-xs">charge.refunded</td><td>charge</td><td>Refund settled</td></tr>
              <tr className="border-b"><td className="py-2 font-mono text-xs">payout.paid</td><td>payout</td><td>Rail settled</td></tr>
              <tr className="border-b"><td className="py-2 font-mono text-xs">payout.failed</td><td>payout</td><td>Rail declined</td></tr>
              <tr className="border-b"><td className="py-2 font-mono text-xs">payout.returned</td><td>payout</td><td>Beneficiary bank rejected</td></tr>
              <tr className="border-b"><td className="py-2 font-mono text-xs">dispute.created</td><td>dispute</td><td>Chargeback opened</td></tr>
              <tr><td className="py-2 font-mono text-xs">dispute.closed</td><td>dispute</td><td>Issuer ruled (won/lost)</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          See <a href="/developer/api-reference/webhook-retry" className="text-primary hover:underline">Webhook retry strategy</a>{" "}
          for delivery semantics and{" "}
          <a href="/developer/api-reference/idempotency" className="text-primary hover:underline">Idempotency keys</a>{" "}
          for safe retry handling.
        </p>
      </CardContent>
    </Card>

    <AutoDocNavigation />
  </div>
);

export default PaymentLifecycleGuide;
