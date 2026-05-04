// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// /developer/api-reference/charge-states
// Dedicated charge state-machine reference (Step C of the discoverability plan).
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const sequence = `
sequenceDiagram
    autonumber
    participant Client as Merchant client
    participant KOB as Kang API
    participant PSP as Provider (MoMo/Card/Bank)
    participant WH as Webhook receiver
    Client->>KOB: POST /v1/charges (Idempotency-Key)
    KOB-->>Client: 201 charge.pending
    KOB->>PSP: Authorize
    PSP-->>KOB: Accepted (processing) / Declined (failed)
    PSP-->>KOB: Final settlement
    KOB->>WH: charge.succeeded | charge.failed
    WH-->>KOB: 2xx ack (else 7-attempt retry)
    Client->>KOB: GET /v1/charges/{id}
    KOB-->>Client: 200 final state
`;

const stateMachine = `
stateDiagram-v2
    [*] --> pending
    pending --> processing: provider accepted
    pending --> failed: validation error
    processing --> succeeded: provider settled
    processing --> failed: provider declined
    succeeded --> refunded: POST /refunds
    succeeded --> disputed: chargeback opened
    refunded --> [*]
    disputed --> resolved: dispute closed
    failed --> [*]
    resolved --> [*]
`;

const rows = [
  { state: "pending", meaning: "Created. Awaiting provider acceptance.", terminal: false, webhook: "—" },
  { state: "processing", meaning: "Provider accepted; awaiting settlement.", terminal: false, webhook: "charge.processing" },
  { state: "succeeded", meaning: "Funds captured.", terminal: false, webhook: "charge.succeeded" },
  { state: "failed", meaning: "Validation error or provider declined.", terminal: true, webhook: "charge.failed" },
  { state: "refunded", meaning: "Full or partial refund issued.", terminal: true, webhook: "charge.refunded" },
  { state: "disputed", meaning: "Chargeback opened against this charge.", terminal: false, webhook: "dispute.created" },
  { state: "resolved", meaning: "Dispute closed (won or lost).", terminal: true, webhook: "dispute.closed" },
];

const ChargeStatesGuide = () => (
  <div className="max-w-5xl mx-auto space-y-8 p-6">
    <SEO
      title="Charge State Machine | Kang Open Banking"
      description="Charge lifecycle and state machine: pending, processing, succeeded, failed, refunded, disputed, resolved. Includes sequence diagram and webhook mapping."
    />
    <header>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Charge state machine</h1>
      <p className="text-muted-foreground mt-3 max-w-3xl">
        Every charge moves through the canonical state machine below. Use it to
        build correct reconciliation, retry, and webhook handling logic.
      </p>
    </header>

    <Card>
      <CardHeader><CardTitle>End-to-end sequence</CardTitle></CardHeader>
      <CardContent><MermaidDiagram chart={sequence} /></CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>State machine</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <MermaidDiagram chart={stateMachine} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">State</th>
                <th className="text-left py-2 font-semibold">Meaning</th>
                <th className="text-left py-2 font-semibold">Terminal</th>
                <th className="text-left py-2 font-semibold">Webhook</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {rows.map((r) => (
                <tr key={r.state} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{r.state}</td>
                  <td className="py-2 pr-4">{r.meaning}</td>
                  <td className="py-2">{r.terminal ? "Yes" : "No"}</td>
                  <td className="py-2 font-mono text-xs">{r.webhook}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          See also <a href="/developer/api-reference/payment-lifecycle" className="text-primary hover:underline">Payment lifecycle</a>,{" "}
          <a href="/developer/api-reference/payout-states" className="text-primary hover:underline">Payout states</a>, and{" "}
          <a href="/developer/api-reference/dispute-lifecycle" className="text-primary hover:underline">Dispute lifecycle</a>.
        </p>
      </CardContent>
    </Card>

    <AutoDocNavigation />
  </div>
);

export default ChargeStatesGuide;
