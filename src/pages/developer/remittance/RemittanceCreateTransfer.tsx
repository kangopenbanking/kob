import { CodeBlock } from "@/components/developer/CodeBlock";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stateMachine = `stateDiagram-v2
    [*] --> created
    created --> pending: Pay-in confirmed
    created --> failed: Pay-in failed
    pending --> received: Partner ACK
    received --> credited: Payout delivered
    credited --> settled: Settlement cycle
    settled --> reversed: Reversal
    created --> failed: Cancelled
    pending --> failed: Timeout
    received --> failed: Payout failed`;

export default function RemittanceCreateTransfer() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">remittance-outbound</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Create Transfer</h1>
        <p className="text-lg text-muted-foreground">
          Initiate a remittance transfer with idempotency, compliance checks, and full lifecycle tracking.
        </p>
      </div>

      {/* State Machine */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Transfer State Machine</h2>
        <MermaidDiagram chart={stateMachine} />
      </div>

      {/* Create Transfer */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Send Money</h2>
        <CodeBlock
          title="POST send"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-outbound \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Idempotency-Key: rem_send_ord456_20260325" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "send",
    "quote_id": "qt_abc123",
    "recipient_name": "Marie Ngo",
    "recipient_phone": "+237670000000",
    "payout_method": "momo_mtn",
    "sender_name": "Pierre Dupont",
    "sender_document_type": "passport",
    "sender_document_number": "FR12345678",
    "purpose": "family_support"
  }'`
          }]}
        />
        <CodeBlock
          title="Response (201)"
          examples={[{
            language: "json",
            code: JSON.stringify({
              transfer: {
                id: "rem_xxx",
                status: "created",
                send_amount: 100,
                send_currency: "EUR",
                receive_amount: 63250,
                receive_currency: "XAF",
                exchange_rate: 632.50,
                fee_amount: 2.50,
                recipient_name: "Marie Ngo",
                payout_method: "momo_mtn",
                compliance_status: "approved",
                created_at: "2026-03-25T19:00:00Z",
              },
            }, null, 2),
          }]}
        />
      </div>

      {/* Idempotency */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-blue-600">🔑 Idempotency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Always include the <code className="text-xs bg-muted px-1 py-0.5 rounded">Idempotency-Key</code> header.
            Replaying the same request with the same key returns the original transfer without creating a duplicate.
          </p>
          <p className="text-sm text-muted-foreground">
            Using the same key with a different payload returns <code className="text-xs bg-muted px-1 py-0.5 rounded">409 Conflict</code>.
          </p>
        </CardContent>
      </Card>

      {/* Track Transfer */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Track Transfer</h2>
        <CodeBlock
          title="GET track"
          examples={[{
            language: "bash",
            code: `curl "https://api.kangopenbanking.com/v1/remittance-outbound?action=track&remittance_id=rem_xxx" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
          }]}
        />
      </div>

      {/* Cancel Transfer */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Cancel Transfer</h2>
        <p className="text-muted-foreground">
          Transfers can only be cancelled while in <code className="text-xs bg-muted px-1 py-0.5 rounded">created</code> status
          (before pay-in is confirmed).
        </p>
        <CodeBlock
          title="POST cancel"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-outbound \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "cancel",
    "remittance_id": "rem_xxx",
    "reason": "Customer request"
  }'`
          }]}
        />
      </div>

      {/* Compliance */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Compliance Checks</h2>
        <p className="text-muted-foreground">
          Every transfer runs through compliance checks automatically:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
          <li><strong>Per-transfer limit</strong> — configurable per corridor</li>
          <li><strong>Daily cap</strong> — per sender phone/document</li>
          <li><strong>Velocity check</strong> — transaction frequency limits</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          If flagged, the transfer moves to <code className="text-xs bg-muted px-1 py-0.5 rounded">compliance_review</code> status
          and requires admin approval via the Admin Command Center.
        </p>
      </div>
    </div>
  );
}
