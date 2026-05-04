// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// /developer/api-reference/dispute-lifecycle
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const sequence = `
sequenceDiagram
    autonumber
    participant Issuer as Issuing bank
    participant KOB as Kang API
    participant Merchant as Merchant client
    participant WH as Webhook receiver
    Issuer->>KOB: Chargeback notification
    KOB->>WH: dispute.created (needs_response)
    Merchant->>KOB: POST /v1/disputes/{id}/evidence
    KOB-->>Merchant: 200 under_review
    KOB->>Issuer: Forward evidence
    Issuer-->>KOB: Final ruling (won | lost)
    KOB->>WH: dispute.closed
    Note over KOB,WH: SLA expiry without evidence => auto-lost
`;

const stateMachine = `
stateDiagram-v2
    [*] --> needs_response: chargeback opened
    needs_response --> under_review: evidence submitted
    needs_response --> lost: SLA expired
    under_review --> won: issuer accepted evidence
    under_review --> lost: issuer rejected evidence
    won --> [*]
    lost --> [*]
`;

const rows = [
  { state: "needs_response", meaning: "Chargeback opened. Submit evidence before the SLA expires.", terminal: false, webhook: "dispute.created" },
  { state: "under_review", meaning: "Evidence submitted; awaiting issuer decision.", terminal: false, webhook: "dispute.evidence_received" },
  { state: "won", meaning: "Issuer accepted evidence; funds returned to merchant.", terminal: true, webhook: "dispute.closed" },
  { state: "lost", meaning: "Issuer rejected evidence or SLA expired.", terminal: true, webhook: "dispute.closed" },
];

const DisputeLifecycleGuide = () => (
  <div className="max-w-5xl mx-auto space-y-8 p-6">
    <SEO
      title="Dispute Lifecycle & State Machine | Kang Open Banking"
      description="Dispute lifecycle: needs_response, under_review, won, lost. Sequence diagram, SLA rules, and evidence submission contract."
    />
    <header>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Dispute lifecycle</h1>
      <p className="text-muted-foreground mt-3 max-w-3xl">
        When an issuer raises a chargeback, the related charge enters the{" "}
        <code className="font-mono text-xs bg-muted px-1 rounded">disputed</code>{" "}
        state and a new dispute resource is opened. Submit evidence before the
        per-network SLA expires; missing the SLA results in an automatic loss.
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

export default DisputeLifecycleGuide;
