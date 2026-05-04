// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// /developer/api-reference/payout-states
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
    participant Rail as Payout rail
    participant WH as Webhook receiver
    Client->>KOB: POST /v1/payouts (Idempotency-Key)
    KOB-->>Client: 201 payout.queued
    KOB->>Rail: Submit instruction
    Rail-->>KOB: Accepted -> processing
    Rail-->>KOB: Settled / Declined / Returned
    KOB->>WH: payout.paid | payout.failed | payout.returned
    WH-->>KOB: 2xx ack (else 7-attempt retry)
`;

const stateMachine = `
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

const rows = [
  { state: "queued", meaning: "Created. Awaiting rail submission.", terminal: false, webhook: "payout.queued" },
  { state: "processing", meaning: "Rail accepted; awaiting settlement.", terminal: false, webhook: "payout.processing" },
  { state: "paid", meaning: "Beneficiary credited.", terminal: true, webhook: "payout.paid" },
  { state: "failed", meaning: "Rail rejected or validation failed.", terminal: true, webhook: "payout.failed" },
  { state: "returned", meaning: "Funds bounced back from beneficiary bank.", terminal: true, webhook: "payout.returned" },
];

const PayoutStatesGuide = () => (
  <div className="max-w-5xl mx-auto space-y-8 p-6">
    <SEO
      title="Payout State Machine | Kang Open Banking"
      description="Payout lifecycle and state machine: queued, processing, paid, failed, returned. Includes sequence diagram and webhook mapping."
    />
    <header>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Payout state machine</h1>
      <p className="text-muted-foreground mt-3 max-w-3xl">
        Payouts can be returned by the receiving rail (e.g. closed account), so
        the state machine includes a terminal <code className="font-mono text-xs bg-muted px-1 rounded">returned</code> state in
        addition to <code className="font-mono text-xs bg-muted px-1 rounded">paid</code> and <code className="font-mono text-xs bg-muted px-1 rounded">failed</code>.
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
          See also <a href="/developer/api-reference/payment-lifecycle" className="text-primary hover:underline">Payment lifecycle</a> and{" "}
          <a href="/developer/api-reference/charge-states" className="text-primary hover:underline">Charge states</a>.
        </p>
      </CardContent>
    </Card>

    <AutoDocNavigation />
  </div>
);

export default PayoutStatesGuide;
